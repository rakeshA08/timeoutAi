import { spawn, execFile } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { db } from '@/lib/db';
import { frames, videos, jobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { ensureProjectDatasetStructure, getProjectDatasetDirs } from '@/lib/yolo/dataset';
import { queueGitSync } from '@/lib/git/sync';

export function getFfmpegPath(): string {
  const binaryName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const localBinary = path.join(process.cwd(), 'node_modules', '@ffmpeg-installer', 'win32-x64', binaryName);
  try {
    if (fsSync.existsSync(/*turbopackIgnore: true*/ localBinary)) {
      return localBinary;
    }
  } catch {
    // fallback
  }
  return 'ffmpeg';
}

export interface VideoMetadata {
  durationSec: number;
  fps: number;
  width: number;
  height: number;
  codec: string;
  totalFramesEstimate: number;
}

export function getVideoDirectories(projectId: string, videoId: string) {
  const baseDir = path.join(process.cwd(), '.cvstudio', 'projects', projectId, 'videos', videoId);
  return {
    baseDir,
    sourceDir: path.join(baseDir, 'source'),
    framesDir: path.join(baseDir, 'frames'),
    thumbsDir: path.join(baseDir, 'thumbnails'),
    metadataFile: path.join(baseDir, 'metadata.json'),
  };
}

export async function readVideoMetadata(videoFilePath: string): Promise<VideoMetadata> {
  const ffmpegPath = getFfmpegPath();
  return new Promise((resolve) => {
    execFile(/*turbopackIgnore: true*/ ffmpegPath, ['-i', videoFilePath], (err, stdout, stderr) => {
      const output = (stderr || '') + (stdout || '');
      let durationSec = 10;
      let fps = 30;
      let width = 1280;
      let height = 720;
      let codec = 'h264';

      const durationMatch = output.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
      if (durationMatch) {
        const hours = parseFloat(durationMatch[1]);
        const mins = parseFloat(durationMatch[2]);
        const secs = parseFloat(durationMatch[3]);
        durationSec = hours * 3600 + mins * 60 + secs;
      }

      const fpsMatch = output.match(/(\d+\.?\d*)\s*fps/);
      if (fpsMatch) {
        fps = parseFloat(fpsMatch[1]);
      }

      const resMatch = output.match(/Stream #.*Video:.*,\s*(\d{3,5})x(\d{3,5})/);
      if (resMatch) {
        width = parseInt(resMatch[1], 10);
        height = parseInt(resMatch[2], 10);
      }

      const codecMatch = output.match(/Video:\s*([a-zA-Z0-9_-]+)/);
      if (codecMatch) {
        codec = codecMatch[1];
      }

      const totalFramesEstimate = Math.max(1, Math.round(durationSec * fps));

      console.log(`[Diagnostic] Video Metadata for ${path.basename(videoFilePath)}:`, {
        durationSec,
        fps,
        resolution: `${width}x${height}`,
        codec,
        totalFramesEstimate,
      });

      resolve({
        durationSec,
        fps,
        width,
        height,
        codec,
        totalFramesEstimate,
      });
    });
  });
}

// Active background extraction process tracker
const activeJobs = new Map<string, {
  jobId: string;
  videoId: string;
  status: string;
  processedFrames: number;
  totalFrames: number;
  percentage: number;
  fps: number;
  elapsedTime: number;
  startTime: number;
  error?: string;
}>();

export function getJobProgress(videoId: string) {
  return activeJobs.get(videoId) || null;
}

export async function startFrameExtraction(
  projectId: string,
  videoId: string,
  sourceVideoPath: string,
  targetFps?: number
) {
  const dirs = getVideoDirectories(projectId, videoId);
  const datasetDirs = await ensureProjectDatasetStructure(projectId);

  await fs.mkdir(dirs.framesDir, { recursive: true });
  await fs.mkdir(dirs.thumbsDir, { recursive: true });

  const metadata = await readVideoMetadata(sourceVideoPath);
  const extractionFps = targetFps || metadata.fps || 30;

  await fs.writeFile(
    dirs.metadataFile,
    JSON.stringify(
      {
        videoId,
        projectId,
        source: sourceVideoPath,
        ...metadata,
        extractionFps,
        createdAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  const jobId = `job_extract_${uuidv4()}`;
  const totalFrames = Math.max(1, Math.round(metadata.durationSec * extractionFps));

  await db.insert(jobs).values({
    id: jobId,
    type: 'FRAME_EXTRACTION',
    status: 'PROCESSING',
    progress: 0,
    payload: JSON.stringify({ projectId, videoId, totalFrames, fps: extractionFps }),
    createdAt: new Date(),
  });

  const jobState: {
    jobId: string;
    videoId: string;
    status: string;
    processedFrames: number;
    totalFrames: number;
    percentage: number;
    fps: number;
    elapsedTime: number;
    startTime: number;
    error?: string;
  } = {
    jobId,
    videoId,
    status: 'PROCESSING',
    processedFrames: 0,
    totalFrames,
    percentage: 0,
    fps: extractionFps,
    elapsedTime: 0,
    startTime: Date.now(),
  };
  activeJobs.set(videoId, jobState);

  const ffmpegPath = getFfmpegPath();
  const framePattern = path.join(dirs.framesDir, 'frame_%06d.jpg');
  const thumbPattern = path.join(dirs.thumbsDir, 'thumb_%06d.jpg');

  const ffmpegArgs = [
    '-y',
    '-i',
    sourceVideoPath,
    '-vf',
    `fps=${extractionFps}`,
    '-q:v',
    '2',
    framePattern,
  ];

  console.log(`[Diagnostic] Spawning FFmpeg: ${ffmpegPath} ${ffmpegArgs.join(' ')}`);
  const ffmpegProcess = spawn(/*turbopackIgnore: true*/ ffmpegPath, ffmpegArgs);

  const indexedFrames = new Set<string>();
  const datasetImagesCreated: string[] = [];
  let isProcessDone = false;

  const pollInterval = setInterval(async () => {
    try {
      if (!fsSync.existsSync(/*turbopackIgnore: true*/ dirs.framesDir)) return;
      const files = await fs.readdir(/*turbopackIgnore: true*/ dirs.framesDir);
      const jpgFiles = files.filter((f) => f.startsWith('frame_') && f.endsWith('.jpg')).sort();

      const newFrames = jpgFiles.filter((f) => !indexedFrames.has(f));
      if (newFrames.length > 0) {
        const frameInserts = [];
        for (const filename of newFrames) {
          indexedFrames.add(filename);
          const frameNumMatch = filename.match(/frame_(\d+)\.jpg/);
          const frameNumber = frameNumMatch ? parseInt(frameNumMatch[1], 10) : indexedFrames.size;
          const timestampSec = (frameNumber - 1) / extractionFps;

          const srcFramePath = path.join(dirs.framesDir, filename);
          const relativePath = path.relative(process.cwd(), srcFramePath).replace(/\\/g, '/');

          // Copy frame to standard YOLO dataset path: images/train/<videoId>_frame_XXXXXX.jpg
          const datasetImageName = `${videoId}_frame_${String(frameNumber).padStart(6, '0')}.jpg`;
          const datasetImagePath = path.join(datasetDirs.imagesTrain, datasetImageName);
          const datasetLabelPath = path.join(datasetDirs.labelsTrain, `${videoId}_frame_${String(frameNumber).padStart(6, '0')}.txt`);

          try {
            await fs.copyFile(srcFramePath, datasetImagePath);
            datasetImagesCreated.push(datasetImagePath);
            // Create empty label file if not existing
            if (!fsSync.existsSync(datasetLabelPath)) {
              await fs.writeFile(datasetLabelPath, '');
            }
          } catch {
            // non-fatal
          }

          frameInserts.push({
            id: `frm_${videoId}_${frameNumber}`,
            videoId,
            frameNumber,
            timestampSec,
            path: relativePath,
            width: metadata.width,
            height: metadata.height,
            status: 'unreviewed' as const,
          });
        }

        if (frameInserts.length > 0) {
          await db.insert(frames).values(frameInserts).onConflictDoNothing();
        }

        jobState.processedFrames = indexedFrames.size;
        jobState.elapsedTime = Math.round((Date.now() - jobState.startTime) / 1000);
        jobState.percentage = Math.min(100, Math.round((jobState.processedFrames / totalFrames) * 100));

        await db
          .update(jobs)
          .set({ progress: jobState.percentage })
          .where(eq(jobs.id, jobId));
      }

      if (isProcessDone) {
        clearInterval(pollInterval);
        jobState.status = 'COMPLETED';
        jobState.percentage = 100;
        jobState.totalFrames = indexedFrames.size;

        // Generate thumbnails
        spawn(/*turbopackIgnore: true*/ ffmpegPath, [
          '-y',
          '-i',
          sourceVideoPath,
          '-vf',
          `fps=${extractionFps},scale=160:90:force_original_aspect_ratio=decrease,pad=160:90:(ow-iw)/2:(oh-ih)/2`,
          '-q:v',
          '3',
          thumbPattern,
        ]);

        await db.update(videos).set({
          status: 'completed',
          totalFrames: indexedFrames.size,
          fps: extractionFps,
        }).where(eq(videos.id, videoId));

        await db.update(jobs).set({
          status: 'COMPLETED',
          progress: 100,
          completedAt: new Date(),
        }).where(eq(jobs.id, jobId));

        // Queue automatic GitHub sync for extracted dataset images
        if (datasetImagesCreated.length > 0) {
          queueGitSync(
            projectId,
            'MANUAL_SYNC',
            [datasetDirs.datasetYaml, datasetDirs.readmeFile, ...datasetImagesCreated.slice(0, 100)],
            `Extracted ${indexedFrames.size} dataset frames for video ${videoId} [CV Studio]`
          ).catch(console.error);
        }

        console.log(`[Diagnostic] Frame Extraction Complete for ${videoId}. Total Frames: ${indexedFrames.size}`);
      }
    } catch (err) {
      console.error('[Diagnostic] Error during frame polling indexing:', err);
    }
  }, 400);

  ffmpegProcess.on('close', (code) => {
    isProcessDone = true;
    if (code !== 0) {
      console.error(`[Diagnostic] FFmpeg process exited with code ${code}`);
      jobState.status = 'FAILED';
      jobState.error = `FFmpeg exited with code ${code}`;
      db.update(jobs).set({ status: 'FAILED', errorMsg: jobState.error }).where(eq(jobs.id, jobId));
    }
  });

  ffmpegProcess.on('error', (err) => {
    console.error(`[Diagnostic] FFmpeg spawn error:`, err);
    jobState.status = 'FAILED';
    jobState.error = err.message;
    isProcessDone = true;
  });

  return jobState;
}

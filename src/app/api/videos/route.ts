import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { videos, frames } from '@/lib/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq, desc } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import { startFrameExtraction, readVideoMetadata, getVideoDirectories } from '@/lib/video/processor';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const videoList = await db
      .select()
      .from(videos)
      .where(eq(videos.projectId, projectId))
      .orderBy(desc(videos.createdAt));

    return NextResponse.json({ videos: videoList });
  } catch (error) {
    console.error('Failed to fetch videos', error);
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let projectId = '';
    let filename = '';
    let targetFps: number | undefined = undefined;

    const videoId = `vid_${uuidv4()}`;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      projectId = (formData.get('projectId') as string) || '';
      const file = formData.get('file') as File | null;
      const fpsParam = formData.get('fps') as string;
      if (fpsParam) targetFps = parseFloat(fpsParam);

      if (!projectId || !file) {
        return NextResponse.json({ error: 'projectId and file are required' }, { status: 400 });
      }

      filename = file.name;
      const dirs = getVideoDirectories(projectId, videoId);
      await fs.mkdir(dirs.sourceDir, { recursive: true });

      const sourceVideoPath = path.join(dirs.sourceDir, filename);
      const bytes = await file.arrayBuffer();
      await fs.writeFile(sourceVideoPath, Buffer.from(bytes));

      const metadata = await readVideoMetadata(sourceVideoPath);
      const fps = targetFps || metadata.fps || 30;
      const totalFrames = Math.max(1, Math.round(metadata.durationSec * fps));

      const newVideo = {
        id: videoId,
        projectId,
        filename,
        fps,
        totalFrames,
        status: 'extracting' as const,
        createdAt: new Date(),
      };

      await db.insert(videos).values(newVideo);

      // Start asynchronous background extraction job
      startFrameExtraction(projectId, videoId, sourceVideoPath, fps).catch(console.error);

      return NextResponse.json({
        success: true,
        video: newVideo,
        metadata,
      }, { status: 201 });
    } else {
      const body = await request.json();
      projectId = body.projectId;
      filename = body.filename || 'sample_clip.mp4';
      targetFps = body.fps || 30;

      if (!projectId) {
        return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
      }

      const dirs = getVideoDirectories(projectId, videoId);
      await fs.mkdir(dirs.sourceDir, { recursive: true });
      const sourceVideoPath = path.join(dirs.sourceDir, filename);

      // Create a dummy video file if none exists for sample testing
      await fs.writeFile(sourceVideoPath, Buffer.from('mock video'));

      const newVideo = {
        id: videoId,
        projectId,
        filename,
        fps: targetFps || 30,
        totalFrames: body.totalFrames || 45,
        status: 'completed' as const,
        createdAt: new Date(),
      };

      await db.insert(videos).values(newVideo);

      // Create sample frames
      await fs.mkdir(dirs.framesDir, { recursive: true });
      await fs.mkdir(dirs.thumbsDir, { recursive: true });

      const count = body.totalFrames || 30;
      const frameInserts = [];
      for (let i = 1; i <= count; i++) {
        const frameName = `frame_${String(i).padStart(6, '0')}.jpg`;
        const relativePath = path.relative(process.cwd(), path.join(dirs.framesDir, frameName)).replace(/\\/g, '/');
        // Create 1x1 placeholder frame if file doesn't exist
        await fs.writeFile(path.join(dirs.framesDir, frameName), Buffer.from(''));
        await fs.writeFile(path.join(dirs.thumbsDir, `thumb_${String(i).padStart(6, '0')}.jpg`), Buffer.from(''));

        frameInserts.push({
          id: `frm_${videoId}_${i}`,
          videoId,
          frameNumber: i,
          timestampSec: (i - 1) / (targetFps || 30),
          path: relativePath,
          width: 1280,
          height: 720,
          status: 'unreviewed' as const,
        });
      }

      await db.insert(frames).values(frameInserts);

      return NextResponse.json({
        success: true,
        video: newVideo,
        framesCount: frameInserts.length,
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Failed to create video', error);
    return NextResponse.json({ error: 'Failed to upload video' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Video id is required' }, { status: 400 });
    }

    const deleted = await db.delete(videos).where(eq(videos.id, id)).returning();
    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error('Failed to delete video', error);
    return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 });
  }
}

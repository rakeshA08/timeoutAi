import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { annotations, frames, projects, videos } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { queueGitSync } from '@/lib/git/sync';

export interface YoloBox {
  classId: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

export interface AnnotationItem {
  id: string;
  frameId: string;
  className: string;
  classId?: number;
  trackId?: string | null;
  x: number; // pixel space or percentage
  y: number; // pixel space or percentage
  width: number;
  height: number;
  confidence?: number | null;
  source?: string;
  isPixelCoordinates?: boolean;
}

const DEFAULT_CLASSES = [
  { id: 0, name: 'ball', color: '#38bdf8' },
  { id: 1, name: 'player', color: '#818cf8' },
  { id: 2, name: 'paddle', color: '#34d399' },
  { id: 3, name: 'table', color: '#fbbf24' },
  { id: 4, name: 'net', color: '#f87171' },
];

export function getProjectDatasetDirs(projectId: string) {
  const projectDir = path.resolve(process.cwd(), '.cvstudio', 'projects', projectId);
  return {
    projectDir,
    imagesTrain: path.join(projectDir, 'images', 'train'),
    imagesValid: path.join(projectDir, 'images', 'valid'),
    imagesTest: path.join(projectDir, 'images', 'test'),
    labelsTrain: path.join(projectDir, 'labels', 'train'),
    labelsValid: path.join(projectDir, 'labels', 'valid'),
    labelsTest: path.join(projectDir, 'labels', 'test'),
    videosSource: path.join(projectDir, 'videos', 'source'),
    metadataFrames: path.join(projectDir, 'metadata', 'frames'),
    metadataVideos: path.join(projectDir, 'metadata', 'videos'),
    datasetYaml: path.join(projectDir, 'dataset.yaml'),
    readmeFile: path.join(projectDir, 'README.md'),
    classesFile: path.join(projectDir, 'classes.json'),
  };
}

/**
 * Initializes the standard Roboflow / YOLO directory structure for the project
 */
export async function ensureProjectDatasetStructure(projectId: string, projectName: string = 'CV Studio Project') {
  const dirs = getProjectDatasetDirs(projectId);
  await fs.mkdir(dirs.imagesTrain, { recursive: true });
  await fs.mkdir(dirs.imagesValid, { recursive: true });
  await fs.mkdir(dirs.imagesTest, { recursive: true });
  await fs.mkdir(dirs.labelsTrain, { recursive: true });
  await fs.mkdir(dirs.labelsValid, { recursive: true });
  await fs.mkdir(dirs.labelsTest, { recursive: true });
  await fs.mkdir(dirs.videosSource, { recursive: true });
  await fs.mkdir(dirs.metadataFrames, { recursive: true });
  await fs.mkdir(dirs.metadataVideos, { recursive: true });

  // Initialize classes.json
  if (!fsSync.existsSync(dirs.classesFile)) {
    await fs.writeFile(dirs.classesFile, JSON.stringify(DEFAULT_CLASSES, null, 2));
  }

  // Initialize dataset.yaml
  await updateDatasetYaml(projectId);

  // Initialize README.md
  if (!fsSync.existsSync(dirs.readmeFile)) {
    const readmeContent = `
# ${projectName} — Computer Vision Dataset

This repository contains a version-controlled computer vision dataset in **YOLO format**, managed via CV Studio.

## Dataset Structure
- \`images/train/\`: Training frame images
- \`labels/train/\`: YOLO bounding box annotation files (matching filenames)
- \`dataset.yaml\`: Ultralytics YOLOv8 / YOLOv11 dataset configuration
- \`metadata/\`: Frame metadata and tracking sequences

## Classes
- \`0\`: ball
- \`1\`: player
- \`2\`: paddle
- \`3\`: table
- \`4\`: net

## Usage with YOLO
\`\`\`bash
yolo task=detect mode=train model=yolov8n.pt data=dataset.yaml epochs=50 imgsz=640
\`\`\`
`.trim();
    await fs.writeFile(dirs.readmeFile, readmeContent);
  }

  return dirs;
}

/**
 * Retrieves classes array for a project
 */
export async function getProjectClasses(projectId: string) {
  const dirs = getProjectDatasetDirs(projectId);
  try {
    if (fsSync.existsSync(dirs.classesFile)) {
      const data = await fs.readFile(dirs.classesFile, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return DEFAULT_CLASSES;
}

/**
 * Updates the dataset.yaml file with the latest classes
 */
export async function updateDatasetYaml(projectId: string) {
  const dirs = getProjectDatasetDirs(projectId);
  const classes = await getProjectClasses(projectId);

  const namesYaml = classes
    .map((c: any, idx: number) => `  ${c.id !== undefined ? c.id : idx}: ${c.name.toLowerCase()}`)
    .join('\n');

  const yamlContent = `
# YOLO Dataset Configuration
path: .
train: images/train
val: images/valid
test: images/test

names:
${namesYaml}
`.trim();

  await fs.writeFile(dirs.datasetYaml, yamlContent);
  return yamlContent;
}

/**
 * Converts bounding box from pixel / percentage space into normalized YOLO format [0..1]
 */
export function convertToYolo(
  box: { x: number; y: number; width: number; height: number; isPixelCoordinates?: boolean },
  imageWidth: number = 1280,
  imageHeight: number = 720
): { centerX: number; centerY: number; width: number; height: number } {
  let x = box.x;
  let y = box.y;
  let w = box.width;
  let h = box.height;

  // If coordinates are in percentage (0-100), convert to [0..1]
  if (!box.isPixelCoordinates && (x <= 100 && y <= 100 && w <= 100 && h <= 100)) {
    const normX = x / 100;
    const normY = y / 100;
    const normW = w / 100;
    const normH = h / 100;

    const centerX = Math.max(0, Math.min(1, normX + normW / 2));
    const centerY = Math.max(0, Math.min(1, normY + normH / 2));
    const width = Math.max(0.0001, Math.min(1, normW));
    const height = Math.max(0.0001, Math.min(1, normH));

    return { centerX, centerY, width, height };
  }

  // If in pixel coordinates:
  const centerX = Math.max(0, Math.min(1, (x + w / 2) / imageWidth));
  const centerY = Math.max(0, Math.min(1, (y + h / 2) / imageHeight));
  const normWidth = Math.max(0.0001, Math.min(1, w / imageWidth));
  const normHeight = Math.max(0.0001, Math.min(1, h / imageHeight));

  return {
    centerX,
    centerY,
    width: normWidth,
    height: normHeight,
  };
}

/**
 * Automatically regenerates the matching YOLO .txt label file for an image,
 * supporting multiple balls/objects (one line per ball/object), and queues GitHub sync.
 */
export async function regenerateYoloLabel(
  projectId: string,
  frameId: string,
  frameNumber: number,
  videoId: string,
  annList: AnnotationItem[],
  imageWidth: number = 1280,
  imageHeight: number = 720,
  options: { queueSync?: boolean; commitMessage?: string } = { queueSync: true }
) {
  const dirs = await ensureProjectDatasetStructure(projectId);
  const classes = await getProjectClasses(projectId);

  // Map class name to integer ID (e.g. ball -> 0)
  const classMap = new Map<string, number>();
  classes.forEach((c: any, idx: number) => {
    classMap.set(c.name.toLowerCase(), c.id !== undefined ? c.id : idx);
  });

  const labelLines: string[] = [];

  for (const ann of annList) {
    const classId =
      ann.classId !== undefined
        ? ann.classId
        : classMap.get((ann.className || 'ball').toLowerCase()) ?? 0;

    const yolo = convertToYolo(ann, imageWidth, imageHeight);

    // Format: class_id center_x center_y width height
    labelLines.push(
      `${classId} ${yolo.centerX.toFixed(6)} ${yolo.centerY.toFixed(6)} ${yolo.width.toFixed(6)} ${yolo.height.toFixed(6)}`
    );
  }

  const labelFileName = `${videoId}_frame_${String(frameNumber).padStart(6, '0')}.txt`;
  const labelFilePath = path.join(dirs.labelsTrain, labelFileName);

  const labelContent = labelLines.join('\n');
  await fs.writeFile(labelFilePath, labelContent);

  console.log(`[Diagnostic] Generated YOLO label for frame ${frameNumber} (${annList.length} objects) -> ${labelFileName}`);

  // Auto-queue Git synchronization if requested
  if (options.queueSync) {
    const changedFiles = [labelFilePath, dirs.datasetYaml];
    const message =
      options.commitMessage ||
      `Update YOLO annotations frame #${frameNumber} (${annList.length} object${annList.length === 1 ? '' : 's'}) [CV Studio]`;

    await queueGitSync(projectId, 'ANNOTATION_SYNC', changedFiles, message);
  }

  return {
    labelFileName,
    labelFilePath,
    labelContent,
    objectCount: annList.length,
  };
}

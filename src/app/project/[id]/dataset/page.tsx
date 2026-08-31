import { db } from '@/lib/db';
import { projects, videos, frames, annotations } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import DatasetClient from './DatasetClient';
import fs from 'fs/promises';
import path from 'path';

const DATA_ROOT = process.env.DATA_ROOT || './.cvstudio';

export default async function DatasetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const projectRecord = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!projectRecord.length) {
    notFound();
  }
  
  const project = projectRecord[0];

  const projectVideos = await db.select().from(videos).where(eq(videos.projectId, id));
  const videoIds = projectVideos.map((v) => v.id);

  let totalFrames = 0;
  let totalAnnotations = 0;

  if (videoIds.length > 0) {
    const projectFrames = await db.select().from(frames).where(inArray(frames.videoId, videoIds));
    totalFrames = projectFrames.length;

    const frameIds = projectFrames.map((f) => f.id);
    if (frameIds.length > 0) {
      const projectAnnotations = await db.select().from(annotations).where(inArray(annotations.frameId, frameIds));
      totalAnnotations = projectAnnotations.length;
    }
  }

  // Load classes
  let classes = [
    { id: 'cls_1', name: 'Ball', color: '#38bdf8' },
    { id: 'cls_2', name: 'Player', color: '#818cf8' },
    { id: 'cls_3', name: 'Racket', color: '#34d399' },
    { id: 'cls_4', name: 'Table', color: '#fbbf24' },
    { id: 'cls_5', name: 'Net', color: '#f87171' },
  ];
  try {
    const classesFile = path.resolve(process.cwd(), DATA_ROOT, 'datasets', 'classes.json');
    const data = await fs.readFile(classesFile, 'utf8');
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      classes = parsed;
    }
  } catch {
    // ignore
  }

  return (
    <DatasetClient
      project={project}
      initialClasses={classes}
      totalFrames={totalFrames}
      totalAnnotations={totalAnnotations}
    />
  );
}

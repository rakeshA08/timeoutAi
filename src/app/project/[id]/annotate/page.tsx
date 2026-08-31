import { db } from '@/lib/db';
import { projects, videos, frames, annotations } from '@/lib/db/schema';
import { eq, inArray, asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import AnnotatorClient from './AnnotatorClient';
import fs from 'fs/promises';
import path from 'path';

const DATA_ROOT = process.env.DATA_ROOT || './.cvstudio';

export default async function AnnotatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const projectRecord = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!projectRecord.length) {
    notFound();
  }

  const project = projectRecord[0];

  // Get project videos and frames
  const projectVideos = await db.select().from(videos).where(eq(videos.projectId, id));
  const videoIds = projectVideos.map((v) => v.id);

  let initialFrames: any[] = [];
  if (videoIds.length > 0) {
    const rawFrames = await db
      .select()
      .from(frames)
      .where(inArray(frames.videoId, videoIds))
      .orderBy(asc(frames.frameNumber));

    initialFrames = rawFrames.map((f) => {
      const thumbPath = f.path.replace('frames/', 'thumbnails/').replace('frame_', 'thumb_');
      return {
        ...f,
        imageUrl: `/api/media?path=${encodeURIComponent(f.path)}`,
        thumbnailUrl: `/api/media?path=${encodeURIComponent(thumbPath)}`,
      };
    });
  }

  // Load classes
  let initialClasses = [
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
      initialClasses = parsed;
    }
  } catch {
    // ignore
  }

  return (
    <AnnotatorClient
      projectId={project.id}
      projectName={project.name}
      initialClasses={initialClasses}
      initialFrames={initialFrames}
      initialVideoId={videoIds[0]}
      githubUrl={project.githubUrl}
    />
  );
}

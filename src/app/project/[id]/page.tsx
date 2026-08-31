import { db } from '@/lib/db';
import { projects, videos } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import VideosClient from './VideosClient';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const projectRecord = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!projectRecord.length) {
    notFound();
  }
  
  const project = projectRecord[0];
  const projectVideos = await db
    .select()
    .from(videos)
    .where(eq(videos.projectId, id))
    .orderBy(desc(videos.createdAt));

  return <VideosClient project={project} initialVideos={projectVideos} />;
}

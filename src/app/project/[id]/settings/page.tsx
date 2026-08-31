import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import SettingsClient from './SettingsClient';

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const projectRecord = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!projectRecord.length) {
    notFound();
  }
  
  const project = projectRecord[0];

  return <SettingsClient project={project} />;
}

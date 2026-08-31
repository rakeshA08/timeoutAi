import { NextResponse } from 'next/server';
import { getProjectGitState, checkRemoteChanges } from '@/lib/git/sync';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const projectRecord = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    const githubUrl = projectRecord[0]?.githubUrl;

    // Check remote changes if url is configured
    if (githubUrl) {
      await checkRemoteChanges(projectId, githubUrl);
    }

    const state = getProjectGitState(projectId);

    return NextResponse.json({
      projectId,
      githubUrl: githubUrl || null,
      syncStatus: state.syncStatus,
      lastCommitHash: state.lastCommitHash,
      lastSyncTime: state.lastSyncTime,
      remoteUpdated: state.remoteUpdated,
    });
  } catch (error) {
    console.error('Failed to get Git status:', error);
    return NextResponse.json({ error: 'Failed to get Git status' }, { status: 500 });
  }
}

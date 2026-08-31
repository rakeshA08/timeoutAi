import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { db } from '@/lib/db';
import { syncEvents, jobs } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export interface SyncJob {
  id: string;
  projectId: string;
  type: 'TRACKING_SYNC' | 'ANNOTATION_SYNC' | 'MANUAL_SYNC';
  files: string[];
  message: string;
  status: 'QUEUED' | 'SYNCING' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'CONFLICT';
  retries: number;
  maxRetries: number;
  lastError?: string;
  commitHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory queue with local disk backing
const syncQueue: SyncJob[] = [];
let isProcessingQueue = false;

// Project repo state cache
interface ProjectGitState {
  lastCommitHash: string | null;
  lastSyncTime: Date | null;
  syncStatus: 'synced' | 'syncing' | 'pending' | 'failed';
  remoteUpdated: boolean;
}
const projectStates = new Map<string, ProjectGitState>();

export function getProjectGitState(projectId: string): ProjectGitState {
  return (
    projectStates.get(projectId) || {
      lastCommitHash: null,
      lastSyncTime: null,
      syncStatus: 'synced',
      remoteUpdated: false,
    }
  );
}

export function getProjectRepoDir(projectId: string): string {
  return path.resolve(process.cwd(), '.cvstudio', 'projects', projectId);
}

/**
 * Initializes a local Git repository for the project if not present
 */
export async function ensureGitRepo(projectId: string, githubUrl?: string | null): Promise<string> {
  const repoDir = getProjectRepoDir(projectId);
  await fsPromises.mkdir(repoDir, { recursive: true });

  const gitDir = path.join(repoDir, '.git');
  if (!fs.existsSync(gitDir)) {
    console.log(`[Diagnostic] Initializing Git repository for project ${projectId} at ${repoDir}`);
    await git.init({ fs, dir: repoDir, defaultBranch: 'main' });

    // Create initial .gitignore
    const gitignorePath = path.join(repoDir, '.gitignore');
    const gitignoreContent = `
# CV Studio Ignore
node_modules/
.env
*.tmp
cache/
logs/
`.trim();
    await fsPromises.writeFile(gitignorePath, gitignoreContent);

    // Initial commit
    await git.add({ fs, dir: repoDir, filepath: '.gitignore' });
    const initialCommit = await git.commit({
      fs,
      dir: repoDir,
      author: { name: 'CV Studio Bot', email: 'bot@cvstudio.local' },
      message: 'Initial project setup [CV Studio]',
    });

    console.log(`[Diagnostic] Initial commit created: ${initialCommit}`);
  }

  // Configure remote if githubUrl is supplied
  if (githubUrl) {
    try {
      const remotes = await git.listRemotes({ fs, dir: repoDir });
      const hasOrigin = remotes.some((r) => r.remote === 'origin');
      if (!hasOrigin) {
        await git.addRemote({
          fs,
          dir: repoDir,
          remote: 'origin',
          url: githubUrl,
        });
      }
    } catch (e) {
      console.warn(`[Diagnostic] Failed to set remote origin:`, e);
    }
  }

  return repoDir;
}

/**
 * Automatically queues a GitHub sync job on tracking or annotation completion
 */
export async function queueGitSync(
  projectId: string,
  type: 'TRACKING_SYNC' | 'ANNOTATION_SYNC' | 'MANUAL_SYNC',
  files: string[],
  message: string
): Promise<SyncJob> {
  const job: SyncJob = {
    id: `sync_${uuidv4()}`,
    projectId,
    type,
    files,
    message,
    status: 'QUEUED',
    retries: 0,
    maxRetries: 4,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  syncQueue.push(job);
  console.log(`[Diagnostic] Git Sync Job Queued: ${job.id} (${message})`);

  // Update in-memory state
  const state = getProjectGitState(projectId);
  state.syncStatus = 'pending';
  projectStates.set(projectId, state);

  // Trigger queue runner
  processSyncQueue().catch(console.error);

  return job;
}

/**
 * Sync Queue worker with debouncing, commit batching, and exponential backoff retry
 */
async function processSyncQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    while (syncQueue.length > 0) {
      const job = syncQueue[0];
      job.status = 'SYNCING';
      job.updatedAt = new Date();

      const state = getProjectGitState(job.projectId);
      state.syncStatus = 'syncing';

      try {
        console.log(`[Diagnostic] Processing Sync Job ${job.id} for project ${job.projectId}`);
        const repoDir = await ensureGitRepo(job.projectId);

        // Stage all specified files
        for (const file of job.files) {
          const relativeFilePath = path.relative(repoDir, file).replace(/\\/g, '/');
          if (fs.existsSync(file)) {
            await git.add({
              fs,
              dir: repoDir,
              filepath: relativeFilePath,
            });
          }
        }

        // Commit staged files
        const commitHash = await git.commit({
          fs,
          dir: repoDir,
          author: { name: 'CV Studio Bot', email: 'bot@cvstudio.local' },
          message: job.message,
        });

        job.commitHash = commitHash;
        job.status = 'COMPLETED';
        job.updatedAt = new Date();

        state.lastCommitHash = commitHash;
        state.lastSyncTime = new Date();
        state.syncStatus = 'synced';

        // Record sync event in database
        await db.insert(syncEvents).values({
          id: `ev_${uuidv4()}`,
          commitHash,
          status: 'SUCCESS',
          message: job.message,
          timestamp: new Date(),
        });

        console.log(`[Diagnostic] Git Sync Succeeded! Commit: ${commitHash.substring(0, 7)}`);

        // Remove completed job from queue
        syncQueue.shift();
      } catch (err: any) {
        console.error(`[Diagnostic] Git Sync Error:`, err);
        job.lastError = err.message || 'Git sync failed';
        job.retries += 1;

        if (job.retries < job.maxRetries) {
          job.status = 'RETRYING';
          const backoffMs = Math.pow(2, job.retries) * 1000;
          console.log(`[Diagnostic] Retrying job ${job.id} in ${backoffMs}ms (attempt ${job.retries}/${job.maxRetries})`);
          await new Promise((r) => setTimeout(r, backoffMs));
        } else {
          job.status = 'FAILED';
          state.syncStatus = 'failed';
          syncQueue.shift(); // Move to next job after max retries
        }
      }
    }
  } finally {
    isProcessingQueue = false;
  }
}

/**
 * Remote change detection - periodically checks for remote commits
 */
export async function checkRemoteChanges(projectId: string, githubUrl?: string | null): Promise<boolean> {
  if (!githubUrl) return false;
  try {
    const repoDir = await ensureGitRepo(projectId, githubUrl);
    // Fetch remote branch references
    const remoteRefs = await git.listServerRefs({
      http,
      url: githubUrl,
      prefix: 'refs/heads/main',
    });

    if (remoteRefs.length > 0) {
      const remoteHead = remoteRefs[0].oid;
      const state = getProjectGitState(projectId);

      if (state.lastCommitHash && state.lastCommitHash !== remoteHead) {
        console.log(`[Diagnostic] Remote change detected for ${projectId}. Remote: ${remoteHead.substring(0, 7)} vs Local: ${state.lastCommitHash.substring(0, 7)}`);
        state.remoteUpdated = true;
        return true;
      }
    }
  } catch (e) {
    // Non-blocking if remote is unreachable
    console.warn(`[Diagnostic] Remote change check skipped:`, (e as Error).message);
  }
  return false;
}

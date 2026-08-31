const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

const dbDir = path.join(process.cwd(), '.cvstudio');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbUrl = 'file:' + path.join(dbDir, 'cvstudio.db');
const client = createClient({ url: dbUrl });

async function init() {
  console.log('Creating database schema with libsql...');

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      github_url TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      fps REAL NOT NULL,
      total_frames INTEGER,
      status TEXT NOT NULL DEFAULT 'queued',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS frames (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      frame_number INTEGER NOT NULL,
      timestamp_sec REAL NOT NULL,
      path TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      status TEXT NOT NULL DEFAULT 'unreviewed'
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      frame_id TEXT NOT NULL REFERENCES frames(id) ON DELETE CASCADE,
      class_name TEXT NOT NULL,
      track_id TEXT,
      x REAL NOT NULL,
      y REAL NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      confidence REAL,
      source TEXT NOT NULL DEFAULT 'manual',
      created_by TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'QUEUED',
      progress REAL DEFAULT 0,
      payload TEXT,
      error_msg TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS sync_events (
      id TEXT PRIMARY KEY,
      commit_hash TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      message TEXT,
      timestamp INTEGER NOT NULL
    );
  `);

  console.log('Schema created successfully!');
}

init().catch(console.error);

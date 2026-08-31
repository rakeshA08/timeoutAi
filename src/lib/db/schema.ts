import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  githubUrl: text('github_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const videos = sqliteTable('videos', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  fps: real('fps').notNull(),
  totalFrames: integer('total_frames'),
  status: text('status', { enum: ['queued', 'extracting', 'completed', 'failed'] }).notNull().default('queued'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const frames = sqliteTable('frames', {
  id: text('id').primaryKey(),
  videoId: text('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
  frameNumber: integer('frame_number').notNull(),
  timestampSec: real('timestamp_sec').notNull(),
  path: text('path').notNull(),
  width: integer('width'),
  height: integer('height'),
  status: text('status', { enum: ['unreviewed', 'reviewed', 'low_confidence'] }).notNull().default('unreviewed'),
});

export const annotations = sqliteTable('annotations', {
  id: text('id').primaryKey(),
  frameId: text('frame_id').notNull().references(() => frames.id, { onDelete: 'cascade' }),
  className: text('class_name').notNull(),
  trackId: text('track_id'),
  x: real('x').notNull(),
  y: real('y').notNull(),
  width: real('width').notNull(),
  height: real('height').notNull(),
  confidence: real('confidence'),
  source: text('source', { enum: ['manual', 'tracker', 'model'] }).notNull().default('manual'),
  createdBy: text('created_by'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['FRAME_EXTRACTION', 'TRACKING', 'GITHUB_SYNC', 'EXPORT'] }).notNull(),
  status: text('status', { enum: ['QUEUED', 'PROCESSING', 'FAILED', 'COMPLETED'] }).notNull().default('QUEUED'),
  progress: real('progress').default(0),
  payload: text('payload'), // JSON string of arguments
  errorMsg: text('error_msg'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

export const syncEvents = sqliteTable('sync_events', {
  id: text('id').primaryKey(),
  commitHash: text('commit_hash'),
  status: text('status', { enum: ['PENDING', 'SYNCING', 'SUCCESS', 'FAILED', 'CONFLICT'] }).notNull().default('PENDING'),
  message: text('message'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

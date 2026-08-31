import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { annotations, frames, videos } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { regenerateYoloLabel, getProjectClasses } from '@/lib/yolo/dataset';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: frameId } = await params;

    const frameRecord = await db.select().from(frames).where(eq(frames.id, frameId)).limit(1);
    if (!frameRecord.length) {
      return NextResponse.json({ error: 'Image / Frame not found' }, { status: 404 });
    }

    const annList = await db.select().from(annotations).where(eq(annotations.frameId, frameId));

    return NextResponse.json({
      frameId,
      annotations: annList,
      count: annList.length,
    });
  } catch (error) {
    console.error('Failed to get annotations for image', error);
    return NextResponse.json({ error: 'Failed to fetch annotations' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: frameId } = await params;
    const body = await request.json();
    const {
      className = 'ball',
      classId,
      trackId,
      x,
      y,
      width,
      height,
      confidence = 1.0,
      source = 'manual',
    } = body;

    if (x === undefined || y === undefined || width === undefined || height === undefined) {
      return NextResponse.json({ error: 'Bounding box coordinates (x, y, width, height) are required' }, { status: 400 });
    }

    const frameRecord = await db.select().from(frames).where(eq(frames.id, frameId)).limit(1);
    if (!frameRecord.length) {
      return NextResponse.json({ error: 'Image / Frame not found' }, { status: 404 });
    }

    const frame = frameRecord[0];
    const videoRecord = await db.select().from(videos).where(eq(videos.id, frame.videoId)).limit(1);
    const projectId = videoRecord[0]?.projectId;

    if (!projectId) {
      return NextResponse.json({ error: 'Project not found for this image' }, { status: 404 });
    }

    // 1. Insert new annotation into SQLite DB
    const newAnn = {
      id: `ann_${uuidv4()}`,
      frameId,
      className,
      trackId: trackId || null,
      x: Number(x),
      y: Number(y),
      width: Number(width),
      height: Number(height),
      confidence: Number(confidence),
      source: (source as any) || 'manual',
      createdBy: 'user',
      updatedAt: new Date(),
    };

    await db.insert(annotations).values(newAnn);

    // Update frame status to reviewed
    await db.update(frames).set({ status: 'reviewed' }).where(eq(frames.id, frameId));

    // 2. Fetch all annotations for this image (including multiple balls)
    const allAnns = await db.select().from(annotations).where(eq(annotations.frameId, frameId));

    // 3. Automatically regenerate the matching YOLO .txt label file & queue GitHub sync
    const yoloResult = await regenerateYoloLabel(
      projectId,
      frameId,
      frame.frameNumber,
      frame.videoId,
      allAnns,
      frame.width || 1280,
      frame.height || 720,
      {
        queueSync: true,
        commitMessage: `Add annotation (${className}) on frame #${frame.frameNumber} [CV Studio]`,
      }
    );

    return NextResponse.json({
      success: true,
      annotation: newAnn,
      totalAnnotationsOnImage: allAnns.length,
      yolo: yoloResult,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create annotation on image', error);
    return NextResponse.json({ error: 'Failed to create annotation' }, { status: 500 });
  }
}

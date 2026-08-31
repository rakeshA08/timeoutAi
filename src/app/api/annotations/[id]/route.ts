import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { annotations, frames, videos } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { regenerateYoloLabel } from '@/lib/yolo/dataset';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: annotationId } = await params;
    const body = await request.json();
    const { x, y, width, height, className, classId, trackId, confidence } = body;

    const annRecord = await db.select().from(annotations).where(eq(annotations.id, annotationId)).limit(1);
    if (!annRecord.length) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    const current = annRecord[0];
    const updates: Partial<typeof current> = {
      updatedAt: new Date(),
    };

    if (x !== undefined) updates.x = Number(x);
    if (y !== undefined) updates.y = Number(y);
    if (width !== undefined) updates.width = Number(width);
    if (height !== undefined) updates.height = Number(height);
    if (className !== undefined) updates.className = className;
    if (trackId !== undefined) updates.trackId = trackId;
    if (confidence !== undefined) updates.confidence = Number(confidence);

    const updated = await db
      .update(annotations)
      .set(updates)
      .where(eq(annotations.id, annotationId))
      .returning();

    // Fetch parent frame and project for YOLO label regeneration
    const frameRecord = await db.select().from(frames).where(eq(frames.id, current.frameId)).limit(1);
    const frame = frameRecord[0];
    const videoRecord = await db.select().from(videos).where(eq(videos.id, frame.videoId)).limit(1);
    const projectId = videoRecord[0]?.projectId;

    let yoloResult = null;
    if (projectId && frame) {
      const allAnns = await db.select().from(annotations).where(eq(annotations.frameId, frame.id));
      yoloResult = await regenerateYoloLabel(
        projectId,
        frame.id,
        frame.frameNumber,
        frame.videoId,
        allAnns,
        frame.width || 1280,
        frame.height || 720,
        {
          queueSync: true,
          commitMessage: `Update annotation (${updates.className || current.className}) on frame #${frame.frameNumber} [CV Studio]`,
        }
      );
    }

    return NextResponse.json({
      success: true,
      annotation: updated[0],
      yolo: yoloResult,
    });
  } catch (error) {
    console.error('Failed to update annotation', error);
    return NextResponse.json({ error: 'Failed to update annotation' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: annotationId } = await params;

    const annRecord = await db.select().from(annotations).where(eq(annotations.id, annotationId)).limit(1);
    if (!annRecord.length) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    const current = annRecord[0];
    await db.delete(annotations).where(eq(annotations.id, annotationId));

    // Regenerate YOLO label file with remaining annotations
    const frameRecord = await db.select().from(frames).where(eq(frames.id, current.frameId)).limit(1);
    const frame = frameRecord[0];
    const videoRecord = await db.select().from(videos).where(eq(videos.id, frame.videoId)).limit(1);
    const projectId = videoRecord[0]?.projectId;

    let yoloResult = null;
    if (projectId && frame) {
      const remainingAnns = await db.select().from(annotations).where(eq(annotations.frameId, frame.id));
      yoloResult = await regenerateYoloLabel(
        projectId,
        frame.id,
        frame.frameNumber,
        frame.videoId,
        remainingAnns,
        frame.width || 1280,
        frame.height || 720,
        {
          queueSync: true,
          commitMessage: `Delete annotation from frame #${frame.frameNumber} (${remainingAnns.length} remaining) [CV Studio]`,
        }
      );
    }

    return NextResponse.json({
      success: true,
      deletedId: annotationId,
      yolo: yoloResult,
    });
  } catch (error) {
    console.error('Failed to delete annotation', error);
    return NextResponse.json({ error: 'Failed to delete annotation' }, { status: 500 });
  }
}

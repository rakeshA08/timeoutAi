import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { annotations, frames } from '@/lib/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const frameId = searchParams.get('frameId');

    if (!frameId) {
      const allAnns = await db.select().from(annotations);
      return NextResponse.json({ annotations: allAnns });
    }

    const frameAnns = await db.select().from(annotations).where(eq(annotations.frameId, frameId));
    return NextResponse.json({ annotations: frameAnns });
  } catch (error) {
    console.error('Failed to fetch annotations', error);
    return NextResponse.json({ error: 'Failed to fetch annotations' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { frameId, annotations: newAnnotations, replaceAll } = body;

    if (!frameId) {
      return NextResponse.json({ error: 'frameId is required' }, { status: 400 });
    }

    if (replaceAll) {
      await db.delete(annotations).where(eq(annotations.frameId, frameId));
    }

    if (Array.isArray(newAnnotations) && newAnnotations.length > 0) {
      const inserts = newAnnotations.map((ann: any) => ({
        id: ann.id || `ann_${uuidv4()}`,
        frameId,
        className: ann.className || 'Object',
        trackId: ann.trackId || null,
        x: Number(ann.x) || 0,
        y: Number(ann.y) || 0,
        width: Number(ann.width) || 0,
        height: Number(ann.height) || 0,
        confidence: ann.confidence !== undefined ? Number(ann.confidence) : 1.0,
        source: ann.source || 'manual',
        createdBy: 'user',
        updatedAt: new Date(),
      }));

      await db.insert(annotations).values(inserts);
      
      // Update frame status to reviewed
      await db.update(frames).set({ status: 'reviewed' }).where(eq(frames.id, frameId));
    }

    const saved = await db.select().from(annotations).where(eq(annotations.frameId, frameId));
    return NextResponse.json({ success: true, annotations: saved });
  } catch (error) {
    console.error('Failed to save annotations', error);
    return NextResponse.json({ error: 'Failed to save annotations' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Annotation id is required' }, { status: 400 });
    }

    const deleted = await db.delete(annotations).where(eq(annotations.id, id)).returning();
    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error('Failed to delete annotation', error);
    return NextResponse.json({ error: 'Failed to delete annotation' }, { status: 500 });
  }
}

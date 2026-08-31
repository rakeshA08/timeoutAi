import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { frames, videos, annotations } from '@/lib/db/schema';
import { eq, inArray, asc, gt } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');
    const projectId = searchParams.get('projectId');
    const limitParam = searchParams.get('limit');
    const cursorParam = searchParams.get('cursor');

    const limit = limitParam ? Math.min(200, parseInt(limitParam, 10)) : 1000;
    const cursor = cursorParam ? parseInt(cursorParam, 10) : 0;

    let videoIds: string[] = [];

    if (videoId) {
      videoIds = [videoId];
    } else if (projectId) {
      const projectVideos = await db.select().from(videos).where(eq(videos.projectId, projectId));
      videoIds = projectVideos.map((v) => v.id);
    }

    if (videoIds.length === 0) {
      return NextResponse.json({ frames: [], total: 0 });
    }

    let query = db
      .select()
      .from(frames)
      .where(inArray(frames.videoId, videoIds))
      .orderBy(asc(frames.frameNumber));

    const allMatchingFrames = await query;
    const total = allMatchingFrames.length;

    // Apply pagination if requested
    const paginated = allMatchingFrames.slice(cursor, cursor + limit);

    // Get annotations map
    const allAnnotations = await db.select().from(annotations);
    const annotationMap = new Map<string, number>();
    for (const ann of allAnnotations) {
      annotationMap.set(ann.frameId, (annotationMap.get(ann.frameId) || 0) + 1);
    }

    const enrichedFrames = paginated.map((f) => {
      const thumbPath = f.path.replace('frames/', 'thumbnails/').replace('frame_', 'thumb_');
      return {
        ...f,
        imageUrl: `/api/media?path=${encodeURIComponent(f.path)}`,
        thumbnailUrl: `/api/media?path=${encodeURIComponent(thumbPath)}`,
        annotationCount: annotationMap.get(f.id) || 0,
      };
    });

    return NextResponse.json({
      frames: enrichedFrames,
      total,
      cursor,
      limit,
      hasMore: cursor + limit < total,
      nextCursor: cursor + limit < total ? cursor + limit : null,
    });
  } catch (error) {
    console.error('Failed to fetch frames', error);
    return NextResponse.json({ error: 'Failed to fetch frames' }, { status: 500 });
  }
}

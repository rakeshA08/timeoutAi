import { NextResponse } from 'next/server';
import { getJobProgress } from '@/lib/video/processor';
import { db } from '@/lib/db';
import { frames, videos } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
    }

    const memoryJob = getJobProgress(videoId);
    if (memoryJob) {
      return NextResponse.json(memoryJob);
    }

    // Fallback to database lookup
    const videoRecord = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    if (!videoRecord.length) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const video = videoRecord[0];
    const frameCount = await db.select().from(frames).where(eq(frames.videoId, videoId));

    return NextResponse.json({
      videoId,
      status: video.status === 'completed' ? 'COMPLETED' : 'PROCESSING',
      processedFrames: frameCount.length,
      totalFrames: video.totalFrames || frameCount.length,
      percentage: video.status === 'completed' ? 100 : Math.min(100, Math.round((frameCount.length / (video.totalFrames || 1)) * 100)),
      fps: video.fps,
      elapsedTime: 0,
    });
  } catch (error) {
    console.error('Failed to get video status', error);
    return NextResponse.json({ error: 'Failed to get video status' }, { status: 500 });
  }
}

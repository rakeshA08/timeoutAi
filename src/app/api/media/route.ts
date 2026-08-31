import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const relativePath = searchParams.get('path');

    if (!relativePath) {
      return new NextResponse('Path is required', { status: 400 });
    }

    // Sanitize path to prevent directory traversal
    const safePath = relativePath.replace(/^(\.\.[\/\\])+/, '');
    const absolutePath = path.resolve(process.cwd(), safePath);

    // Verify file exists
    try {
      const stats = await fs.stat(absolutePath);
      if (!stats.isFile()) {
        return new NextResponse('Not a file', { status: 404 });
      }
    } catch {
      return new NextResponse('File not found', { status: 404 });
    }

    const fileBuffer = await fs.readFile(absolutePath);
    const ext = path.extname(absolutePath).toLowerCase();
    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.mp4') contentType = 'video/mp4';
    else if (ext === '.json') contentType = 'application/json';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Media server error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

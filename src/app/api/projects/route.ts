import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

const DATA_ROOT = process.env.DATA_ROOT || './.cvstudio';

async function ensureProjectStructure() {
  const dirs = [
    DATA_ROOT,
    path.join(DATA_ROOT, 'videos', 'original'),
    path.join(DATA_ROOT, 'videos', 'processed'),
    path.join(DATA_ROOT, 'datasets', 'images', 'train'),
    path.join(DATA_ROOT, 'datasets', 'images', 'valid'),
    path.join(DATA_ROOT, 'datasets', 'images', 'test'),
    path.join(DATA_ROOT, 'datasets', 'annotations', 'train'),
    path.join(DATA_ROOT, 'datasets', 'annotations', 'valid'),
    path.join(DATA_ROOT, 'datasets', 'annotations', 'test'),
    path.join(DATA_ROOT, 'frames'),
    path.join(DATA_ROOT, 'tracking'),
    path.join(DATA_ROOT, 'exports'),
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  // Create initial classes.json if not exists
  const classesFile = path.join(DATA_ROOT, 'datasets', 'classes.json');
  try {
    await fs.access(classesFile);
  } catch {
    await fs.writeFile(classesFile, JSON.stringify([]));
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const projectRecord = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
      if (!projectRecord.length) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      return NextResponse.json({ project: projectRecord[0] });
    }

    const allProjects = await db.select().from(projects);
    return NextResponse.json({ projects: allProjects });
  } catch (error) {
    console.error('Failed to fetch projects', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, githubUrl } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    await ensureProjectStructure();

    const id = `proj_${uuidv4()}`;
    await db.insert(projects).values({
      id,
      name,
      githubUrl: githubUrl || null,
      createdAt: new Date(),
    });

    // Generate local project metadata config
    await fs.writeFile(
      path.join(DATA_ROOT, 'project.json'),
      JSON.stringify({ id, name, githubUrl, createdAt: new Date() }, null, 2)
    );

    return NextResponse.json({ id, name, githubUrl }, { status: 201 });
  } catch (error) {
    console.error('Failed to create project', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, name, githubUrl } = body;

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const updates: Partial<{ name: string; githubUrl: string | null }> = {};
    if (name !== undefined) updates.name = name;
    if (githubUrl !== undefined) updates.githubUrl = githubUrl || null;

    const updated = await db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, id))
      .returning();

    if (!updated.length) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, project: updated[0] });
  } catch (error) {
    console.error('Failed to update project', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {

  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
      } catch {
        // body was not json or empty
      }
    }

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const deleted = await db.delete(projects).where(eq(projects.id, id)).returning();

    // Check if .cvstudio/project.json is for this project
    const projectJsonPath = path.join(DATA_ROOT, 'project.json');
    try {
      const data = await fs.readFile(projectJsonPath, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed.id === id) {
        await fs.unlink(projectJsonPath);
      }
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully',
      deleted,
    });
  } catch (error) {
    console.error('Failed to delete project', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}

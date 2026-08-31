import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_ROOT = process.env.DATA_ROOT || './.cvstudio';

const DEFAULT_CLASSES = [
  { id: 'cls_1', name: 'Ball', color: '#38bdf8' },
  { id: 'cls_2', name: 'Player', color: '#818cf8' },
  { id: 'cls_3', name: 'Racket', color: '#34d399' },
  { id: 'cls_4', name: 'Table', color: '#fbbf24' },
  { id: 'cls_5', name: 'Net', color: '#f87171' },
];

async function getClassesFilePath() {
  const dir = path.resolve(process.cwd(), DATA_ROOT, 'datasets');
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, 'classes.json');
}

export async function GET() {
  try {
    const file = await getClassesFilePath();
    try {
      const data = await fs.readFile(file, 'utf8');
      const classes = JSON.parse(data);
      if (Array.isArray(classes) && classes.length > 0) {
        return NextResponse.json({ classes });
      }
    } catch {
      // file doesn't exist yet or is empty
    }

    // Write defaults if empty
    await fs.writeFile(file, JSON.stringify(DEFAULT_CLASSES, null, 2));
    return NextResponse.json({ classes: DEFAULT_CLASSES });
  } catch (error) {
    console.error('Failed to get classes', error);
    return NextResponse.json({ error: 'Failed to fetch classes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, color } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Class name is required' }, { status: 400 });
    }

    const file = await getClassesFilePath();
    let classes = [...DEFAULT_CLASSES];
    try {
      const data = await fs.readFile(file, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        classes = parsed;
      }
    } catch {
      // ignore
    }

    const newClass = {
      id: `cls_${Date.now()}`,
      name: name.trim(),
      color: color || '#818cf8',
    };

    classes.push(newClass);
    await fs.writeFile(file, JSON.stringify(classes, null, 2));

    return NextResponse.json({ success: true, class: newClass, classes }, { status: 201 });
  } catch (error) {
    console.error('Failed to add class', error);
    return NextResponse.json({ error: 'Failed to add class' }, { status: 500 });
  }
}

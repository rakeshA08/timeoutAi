import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

const dbDir = path.resolve(process.cwd(), '.cvstudio');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'cvstudio.db');
const dbUrl = process.env.DATABASE_URL || `file:${dbPath}`;

const client = createClient({ url: dbUrl });
export const db = drizzle(client, { schema });


import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import 'dotenv/config';

// Em produção adiciona sslmode=require à connection string
function buildConnectionUrl(url: string): string {
  if (process.env.NODE_ENV !== 'production') return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}sslmode=require`;
}

const client = postgres(buildConnectionUrl(process.env.DATABASE_URL!));
export const db = drizzle(client, { schema });
export default db;

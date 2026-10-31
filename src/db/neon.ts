import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.ts';

/**
 * Neon PostgreSQL Client with Drizzle ORM
 * Connected via @neondatabase/serverless over HTTPS / HTTP pooling
 * Ideal for serverless environments (Vercel, Cloud Functions)
 */

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

export function isNeonConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}

/**
 * Ensures database configuration exists in production.
 * In-memory fallback is strictly restricted to development & testing.
 */
export function ensureDatabaseConfigured(): void {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && !isNeonConfigured()) {
    throw new Error(
      'FATAL CONFIGURATION ERROR: Production environment detected, but DATABASE_URL is not set. ' +
      'In-memory / local JSON fallback is strictly restricted to development and testing environments. ' +
      'Please configure DATABASE_URL in Vercel or your production environment settings.'
    );
  }
}

export function getNeonDb() {
  const url = getDatabaseUrl();
  if (!url) {
    ensureDatabaseConfigured();
    return null;
  }

  if (!dbInstance) {
    const sql = neon(url);
    dbInstance = drizzle(sql, { schema });
  }
  return dbInstance;
}

export { schema };

/**
 * Drizzle Migration Runner for Vercel Postgres / Neon
 * Run via: npx tsx src/db/migrate.ts
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.warn('DATABASE_URL or POSTGRES_URL is not set. Skipping SQL migration runner.');
    return;
  }

  console.log('Connecting to PostgreSQL for migration...');
  const client = new pg.Client({ connectionString });
  await client.connect();

  const db = drizzle(client);
  console.log('Running Drizzle migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations applied successfully!');

  await client.end();
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

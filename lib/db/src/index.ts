import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isProduction = process.env.NODE_ENV === "production";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase's Session Pooler is the IPv4-compatible endpoint for Railway.
  // It requires TLS in production. The pooler presents a managed certificate,
  // but its chain is not always available in minimal container images.
  ssl: isProduction ? { rejectUnauthorized: false } : undefined,
  options: "-c search_path=forehead,public",
  max: Number(process.env.DB_POOL_MAX ?? 10),
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 10_000),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30_000),
  keepAlive: true,
});
export const db = drizzle(pool, { schema });

pool.on("error", (error) => {
  console.error("[database] unexpected idle client error", formatDatabaseError(error));
});

export function formatDatabaseError(error: unknown) {
  if (!(error instanceof Error)) return { message: String(error) };
  const pgError = error as Error & { code?: string; detail?: string; hint?: string };
  return {
    name: pgError.name,
    message: pgError.message,
    code: pgError.code,
    detail: pgError.detail,
    hint: pgError.hint,
    stack: pgError.stack,
  };
}

/**
 * Create the database tables required by the existing multiplayer server.
 *
 * Railway PostgreSQL services start empty. The original Replit project did
 * not include migrations, so production needs a small idempotent bootstrap.
 * The advisory lock prevents two replicas from initializing concurrently.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("CREATE SCHEMA IF NOT EXISTS forehead");
    await client.query("SET LOCAL search_path TO forehead, public");
    await client.query("SELECT pg_advisory_xact_lock(1179864656)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL DEFAULT 'text',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS category_items (
        id SERIAL PRIMARY KEY,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        item_text TEXT NOT NULL,
        image_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS characters (
        id SERIAL PRIMARY KEY,
        answer TEXT NOT NULL,
        hints TEXT[] NOT NULL,
        lang TEXT NOT NULL DEFAULT 'en',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS charades (
        id SERIAL PRIMARY KEY,
        answer TEXT NOT NULL,
        lang TEXT NOT NULL DEFAULT 'en',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS dykm_categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        lang TEXT NOT NULL DEFAULT 'en',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS dykm_questions (
        id SERIAL PRIMARY KEY,
        category_id INTEGER NOT NULL REFERENCES dykm_categories(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'waiting',
        mode TEXT NOT NULL DEFAULT 'forehead',
        lang TEXT NOT NULL DEFAULT 'en',
        category_id INTEGER REFERENCES categories(id),
        turn_duration INTEGER NOT NULL DEFAULT 60,
        round_count INTEGER NOT NULL DEFAULT 1,
        current_turn_player_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        is_host BOOLEAN NOT NULL DEFAULT FALSE,
        score INTEGER NOT NULL DEFAULT 0,
        connected BOOLEAN NOT NULL DEFAULT TRUE,
        session_token TEXT,
        joined_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS turns (
        id SERIAL PRIMARY KEY,
        room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        player_id INTEGER NOT NULL REFERENCES players(id),
        item_id INTEGER,
        item_text TEXT,
        image_url TEXT,
        result TEXT,
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ended_at TIMESTAMP,
        turn_number INTEGER NOT NULL DEFAULT 0
      );
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export * from "./schema";

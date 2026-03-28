import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const isRailway =
  process.env.DATABASE_URL?.includes("railway") ||
  process.env.DATABASE_URL?.includes("rlwy");

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRailway ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  console.error("[DB] Unexpected pool error:", err.message);
});

pool.on("connect", (client) => {
  client.query("SET statement_timeout = 5000").catch((err) => {
    console.error("[DB] Failed to set statement_timeout:", err.message);
  });
});

export let dbConnected = false;
export let serverReady = false;

export function markServerReady(): void {
  serverReady = true;
}

async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log("[DB] Running idempotent schema migrations...");
    await client.query(`
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS revised_start_time TIMESTAMP;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS admin_unlock_override BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS first_scorecard_at TIMESTAMP;
    `);
    // Add id column to match_player_status if missing (older production DBs lack it).
    await client.query(`
      ALTER TABLE match_player_status ADD COLUMN IF NOT EXISTS id VARCHAR DEFAULT gen_random_uuid();
      UPDATE match_player_status SET id = gen_random_uuid() WHERE id IS NULL;
    `);
    // Allow null captainId/viceCaptainId for teams where C or VC is on the Impact Slot.
    // Safe to run repeatedly — PostgreSQL no-ops if the column is already nullable.
    await client.query(`
      ALTER TABLE user_teams ALTER COLUMN captain_id DROP NOT NULL;
      ALTER TABLE user_teams ALTER COLUMN vice_captain_id DROP NOT NULL;
    `);
    console.log("[DB] Migrations complete.");
  } catch (err: any) {
    console.error("[DB] Migration error:", err.message);
  } finally {
    client.release();
  }
}

export async function connectWithRetry(
  maxAttempts = 10,
  delayMs = 3000,
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `[DB] Connecting to database... (attempt ${attempt}/${maxAttempts})`,
      );
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      dbConnected = true;
      console.log("[DB] Connected successfully");
      await runMigrations();
      return;
    } catch (err: any) {
      console.error(
        `[DB] Connection failed (attempt ${attempt}/${maxAttempts}): ${err.message}`,
      );
      if (attempt < maxAttempts) {
        console.log(`[DB] Retrying in ${delayMs / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  console.error(
    "[DB] All connection attempts failed. Server will start but DB calls may fail.",
  );
}

export const db = drizzle(pool, { schema });

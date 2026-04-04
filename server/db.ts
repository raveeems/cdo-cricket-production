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

    // matches — columns added incrementally across deployments
    await client.query(`
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS series_id VARCHAR;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS team1_color VARCHAR(10) NOT NULL DEFAULT '#333';
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS team2_color VARCHAR(10) NOT NULL DEFAULT '#666';
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_name TEXT;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS entry_stake INTEGER NOT NULL DEFAULT 30;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS pot_processed BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS official_winner VARCHAR(10);
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_void BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS impact_features_enabled BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS revised_start_time TIMESTAMP;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS admin_unlock_override BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS first_scorecard_at TIMESTAMP;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS pot_mode VARCHAR(30) NOT NULL DEFAULT 'entries_only';
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS pot_penalty_user_ids JSONB NOT NULL DEFAULT '[]';
    `);

    // players — api_name added for name-matching against external APIs
    await client.query(`
      ALTER TABLE players ADD COLUMN IF NOT EXISTS api_name TEXT;
    `);

    // user_teams — impact slot + invisible mode + backup XI columns added over time
    await client.query(`
      ALTER TABLE user_teams ADD COLUMN IF NOT EXISTS primary_impact_id VARCHAR;
      ALTER TABLE user_teams ADD COLUMN IF NOT EXISTS backup_impact_id VARCHAR;
      ALTER TABLE user_teams ADD COLUMN IF NOT EXISTS captain_type VARCHAR(20) NOT NULL DEFAULT 'player';
      ALTER TABLE user_teams ADD COLUMN IF NOT EXISTS vc_type VARCHAR(20) NOT NULL DEFAULT 'player';
      ALTER TABLE user_teams ADD COLUMN IF NOT EXISTS invisible_mode BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE user_teams ADD COLUMN IF NOT EXISTS prediction_points INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE user_teams ADD COLUMN IF NOT EXISTS backup_xi_player_1_id VARCHAR;
      ALTER TABLE user_teams ADD COLUMN IF NOT EXISTS backup_xi_player_2_id VARCHAR;
    `);

    // Allow null captainId/viceCaptainId for teams where C or VC is on the Impact Slot.
    await client.query(`
      ALTER TABLE user_teams ALTER COLUMN captain_id DROP NOT NULL;
      ALTER TABLE user_teams ALTER COLUMN vice_captain_id DROP NOT NULL;
    `);

    // match_player_status — id column + impact sub fields added later
    await client.query(`
      ALTER TABLE match_player_status ADD COLUMN IF NOT EXISTS id VARCHAR DEFAULT gen_random_uuid();
      ALTER TABLE match_player_status ADD COLUMN IF NOT EXISTS official_impact_sub_used BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE match_player_status ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'admin';
      UPDATE match_player_status SET id = gen_random_uuid() WHERE id IS NULL;
    `);

    // push_tokens — FCM push notification token storage
    await client.query(`
      CREATE TABLE IF NOT EXISTS push_tokens (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
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

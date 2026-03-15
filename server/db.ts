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

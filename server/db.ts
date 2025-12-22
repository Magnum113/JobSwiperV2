import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

let pool: pg.Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;
let connectionPromise: Promise<void> | null = null;

function getPool(): pg.Pool | null {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pool;
}

export async function ensureDbConnected(): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  
  if (connectionPromise) {
    await connectionPromise;
    return !!dbInstance;
  }
  
  connectionPromise = (async () => {
    try {
      const client = await p.connect();
      console.log("[Database] Connected successfully");
      client.release();
      dbInstance = drizzle(p, { schema });
    } catch (err: any) {
      console.error("[Database] Connection failed:", err.message);
      dbInstance = null;
    }
  })();
  
  await connectionPromise;
  return !!dbInstance;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    if (!dbInstance) {
      const p = getPool();
      if (p) {
        dbInstance = drizzle(p, { schema });
      }
    }
    if (!dbInstance) {
      throw new Error("Database not available");
    }
    return (dbInstance as any)[prop];
  }
});

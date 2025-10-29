import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient } from "pg";

// Single pool using the primary DATABASE_URL.
// Role separation is handled via `SET ROLE` inside scoped helpers.
let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const url =
    process.env.DATABASE_URL ??
    process.env.commercial_survey_DATABASE_URL ??
    process.env.COMMERCIAL_SURVEY_DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Provide DATABASE_URL (or commercial_survey_DATABASE_URL) in the environment."
    );
  }
  pool = new Pool({ connectionString: url, max: 10 });
  return pool;
}

// Execute a function inside a transaction as platform role
type ScopedDb = NodePgDatabase<Record<string, never>> & { $client: PoolClient };

export async function withPlatformDb<T>(fn: (db: ScopedDb) => Promise<T>): Promise<T> {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    // Set application role for RLS via GUC
    await client.query("SELECT set_config($1, $2, true)", ["app.role", "platform"]);
    const db = drizzle(client) as ScopedDb;
    const result = await fn(db);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

// Execute a function inside a transaction as seller role, binding sellerId to GUC app.user_id
export async function withSellerDb<T>(sellerId: number, fn: (db: ScopedDb) => Promise<T>): Promise<T> {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    // Set application role and seller context for RLS via GUCs
    await client.query("SELECT set_config($1, $2, true)", ["app.role", "seller"]);
    await client.query("SELECT set_config($1, $2, true)", ["app.user_id", String(sellerId)]);
    const db = drizzle(client) as ScopedDb;
    const result = await fn(db);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

export type DbScoped = ScopedDb;

import { Pool } from "pg";

/**
 * Postgres-backed plan storage, used when DATABASE_URL is set (docker compose).
 * The plan is a single JSONB document — one row, upserted on every save.
 */

let pool: Pool | null = null;
let schemaReady: Promise<unknown> | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    });
  }
  return pool;
}

function ensureSchema() {
  if (!schemaReady) {
    schemaReady = getPool().query(
      `CREATE TABLE IF NOT EXISTS plan (
         id INTEGER PRIMARY KEY,
         data JSONB NOT NULL,
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`
    );
  }
  return schemaReady;
}

export async function dbGetPlan(): Promise<unknown | null> {
  await ensureSchema();
  const res = await getPool().query("SELECT data FROM plan WHERE id = 1");
  return res.rows[0]?.data ?? null;
}

export async function dbPutPlan(data: unknown): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `INSERT INTO plan (id, data, updated_at) VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = now()`,
    [JSON.stringify(data)]
  );
}

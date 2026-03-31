import { Pool, QueryResult } from "pg";

/* =========================================================
   POOL
========================================================= */

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

/* =========================================================
   QUERY
========================================================= */

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const client = await pool.connect();

  try {
    return await client.query<T>(text, params);
  } catch (err) {
    console.error("❌ DB QUERY ERROR:", err);
    throw err;
  } finally {
    client.release();
  }
}

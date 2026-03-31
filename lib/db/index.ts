import { Pool } from "pg";

/**
 * 🔥 PostgreSQL connection (Supabase DB)
 * Uses DATABASE_URL
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

/**
 * 🔥 Safe query wrapper
 */
export async function query(
  text: string,
  params?: unknown[]
) {
  const client = await pool.connect();

  try {
    const res = await client.query(text, params);
    return res;
  } catch (err) {
    console.error("DB QUERY ERROR:", err);
    throw err;
  } finally {
    client.release();
  }
}

import { Pool, PoolClient, QueryResult } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var _pool: Pool | undefined;
}

const pool =
  global._pool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },

    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== "production") {
  global._pool = pool;
}

/* ================= TYPES ================= */

type DbError = {
  code?: string;
  message?: string;
  detail?: string;
  constraint?: string;
  table?: string;
};

/* ================= ERROR MAP ================= */

function mapDbError(err: unknown): Error {
  const e = err as DbError;

  switch (e.code) {
    case "23505":
      return new Error("DUPLICATE");

    case "23503":
      return new Error("INVALID_REFERENCE");

    case "23514":
      return new Error("INVALID_DATA");

    default:
      return new Error("DB_ERROR");
  }
}

/* ================= SAFE LOG ================= */

function logDbError(prefix: string, err: unknown) {
  const e = err as DbError;

  console.error(prefix, {
    code: e.code ?? "UNKNOWN",
    message: e.message ?? "UNKNOWN",
    constraint: e.constraint ?? null,
    table: e.table ?? null,
  });
}

/* ================= QUERY ================= */

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  try {
    return await pool.query<T>(text, params);
  } catch (err) {
    logDbError("🔥 [DB][QUERY_ERROR]", err);

    throw mapDbError(err);
  }
}

/* ================= TRANSACTION ================= */

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await fn(client);

    await client.query("COMMIT");

    return result;
  } catch (err) {
    await client.query("ROLLBACK");

    logDbError("🔥 [DB][TX_ERROR]", err);

    throw mapDbError(err);
  } finally {
    client.release();
  }
}

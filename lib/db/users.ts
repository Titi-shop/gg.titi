import { query } from "@/lib/db";

export async function upsertUserFromPi(
  pi_uid: string,
  username: string
): Promise<{ id: string; role: string | null }> {
  await query(
    `
    INSERT INTO users (pi_uid, username)
    VALUES ($1, $2)
    ON CONFLICT (pi_uid)
    DO UPDATE SET username = EXCLUDED.username
    `,
    [pi_uid, username]
  );

  const res = await query(
    `
    SELECT id, role
    FROM users
    WHERE pi_uid = $1
    LIMIT 1
    `,
    [pi_uid]
  );

  return res.rows[0];
}

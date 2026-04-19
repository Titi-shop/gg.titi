import { query } from "@/lib/db";

export async function getWalletByUserId(userId: string) {
  // 🔥 ensure wallet exists
  await query(
    `
    INSERT INTO wallets (user_id, balance)
    VALUES ($1, 0)
    ON CONFLICT (user_id) DO NOTHING
    `,
    [userId]
  );

  const { rows } = await query<{
    balance: string;
  }>(
    `
    SELECT balance
    FROM wallets
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  return {
    balance: Number(rows[0]?.balance || 0),
  };
}

export async function payWithWallet(params: {
  userId: string;
  orderId: string;
}) {
  const { userId, orderId } = params;

  return withTransaction(async (client) => {

    /* ================= GET ORDER ================= */

    const { rows: orderRows } = await client.query<{
      total_amount: string;
      status: string;
    }>(
      `
      SELECT total_amount, status
      FROM orders
      WHERE id = $1 AND buyer_id = $2
      FOR UPDATE
      `,
      [orderId, userId]
    );

    const order = orderRows[0];

    if (!order) throw new Error("ORDER_NOT_FOUND");

    if (order.status !== "pending") {
      throw new Error("INVALID_STATE");
    }

    const amount = Number(order.total_amount);

    /* ================= LOCK WALLET ================= */

    const { rows: walletRows } = await client.query<{
      balance: string;
    }>(
      `
      SELECT balance
      FROM wallets
      WHERE user_id = $1
      FOR UPDATE
      `,
      [userId]
    );

    const wallet = walletRows[0];

    if (!wallet) throw new Error("WALLET_NOT_FOUND");

    const balance = Number(wallet.balance);

    if (balance < amount) {
      throw new Error("INSUFFICIENT_BALANCE");
    }

    /* ================= UPDATE WALLET ================= */

    await client.query(
      `
      UPDATE wallets
      SET balance = balance - $1
      WHERE user_id = $2
      `,
      [amount, userId]
    );

    /* ================= LOG ================= */

    await client.query(
      `
      INSERT INTO wallet_transactions (
        user_id,
        type,
        amount,
        reference_type,
        reference_id
      )
      VALUES ($1, 'debit', $2, 'order', $3)
      `,
      [userId, amount, orderId]
    );

    /* ================= UPDATE ORDER ================= */

    await client.query(
      `
      UPDATE orders
      SET status = 'paid'
      WHERE id = $1
      `,
      [orderId]
    );
  });
}

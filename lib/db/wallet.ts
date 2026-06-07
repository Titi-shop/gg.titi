import { query, withTransaction } from "@/lib/db";

/* =====================================================
   TYPES
===================================================== */

type WalletRow = {
  balance: string;
};

type OrderRow = {
  total_amount: string;
  status: string;
};

/* =====================================================
   HELPERS
===================================================== */

function isValidUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

function toNumberSafe(value: unknown, field: string): number {
  const n = Number(value);

  if (Number.isNaN(n)) {
    console.error("❌ [WALLET][PARSE_ERROR]", { field, value });
    throw new Error("INVALID_NUMBER");
  }

  return n;
}

function error(message: string): never {
  throw new Error(message);
}

/* =====================================================
   GET WALLET
===================================================== */

export async function getWalletByUserId(userId: string) {
  if (!isValidUuid(userId)) {
    error("INVALID_USER_ID");
  }

  console.log("🟡 [WALLET][GET] START", { userId });

  // ensure wallet tồn tại
  await query(
    `
    INSERT INTO wallets (user_id, balance)
    VALUES ($1, 0)
    ON CONFLICT (user_id) DO NOTHING
    `,
    [userId]
  );

  const { rows } = await query<WalletRow>(
    `
    SELECT balance
    FROM wallets
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  const balance = toNumberSafe(rows[0]?.balance ?? 0, "balance");

  console.log("🟢 [WALLET][GET] SUCCESS", {
    userId,
    balance,
  });

  return { balance };
}

/* =====================================================
   CREDIT WALLET (REFUND)
===================================================== */

export async function creditWallet(params: {
  userId: string;
  amount: number;
  referenceId: string;
  idempotencyKey: string;
}) {
  const { userId, amount, referenceId, idempotencyKey } = params;

  if (!isValidUuid(userId) || !isValidUuid(referenceId)) {
    error("INVALID_INPUT");
  }

  if (!amount || amount <= 0) {
    error("INVALID_AMOUNT");
  }

  console.log("🟡 [WALLET][CREDIT] START", {
    userId,
    amount,
    referenceId,
  });

  return withTransaction(async (client) => {
    /* ================= LOCK WALLET ================= */

    const { rows } = await client.query<WalletRow>(
      `
      SELECT balance
      FROM wallets
      WHERE user_id = $1
      FOR UPDATE
      `,
      [userId]
    );

    if (!rows[0]) {
      error("WALLET_NOT_FOUND");
    }

    const before = toNumberSafe(rows[0].balance, "balance_before");
    const after = before + amount;

    console.log("💰 [WALLET][CREDIT][CALC]", {
      before,
      amount,
      after,
    });

    /* ================= IDEMPOTENT INSERT ================= */

    const insert = await client.query(
      `
      INSERT INTO wallet_transactions (
        user_id,
        type,
        amount,
        reference_type,
        reference_id,
        idempotency_key,
        balance_before,
        balance_after
      )
      VALUES ($1,'credit',$2,'refund',$3,$4,$5,$6)
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id
      `,
      [userId, amount, referenceId, idempotencyKey, before, after]
    );

    if (insert.rowCount === 0) {
      console.warn("⚠️ [WALLET][CREDIT] DUPLICATE IGNORED", {
        idempotencyKey,
      });
      return;
    }

    /* ================= UPDATE BALANCE ================= */

    await client.query(
      `
      UPDATE wallets
      SET balance = $1,
          updated_at = now()
      WHERE user_id = $2
      `,
      [after, userId]
    );

    console.log("🟢 [WALLET][CREDIT] SUCCESS", {
      userId,
      amount,
      after,
    });
  });
}

/* =====================================================
   DEBIT WALLET (PAY)
===================================================== */

export async function debitWallet(params: {
  userId: string;
  amount: number;
  referenceId: string;
  idempotencyKey: string;
}) {
  const { userId, amount, referenceId, idempotencyKey } = params;

  if (!isValidUuid(userId) || !isValidUuid(referenceId)) {
    error("INVALID_INPUT");
  }

  if (!amount || amount <= 0) {
    error("INVALID_AMOUNT");
  }

  console.log("🟡 [WALLET][DEBIT] START", {
    userId,
    amount,
    referenceId,
  });

  return withTransaction(async (client) => {
    /* ================= LOCK WALLET ================= */

    const { rows } = await client.query<WalletRow>(
      `
      SELECT balance
      FROM wallets
      WHERE user_id = $1
      FOR UPDATE
      `,
      [userId]
    );

    if (!rows[0]) {
      error("WALLET_NOT_FOUND");
    }

    const before = toNumberSafe(rows[0].balance, "balance_before");

    if (before < amount) {
      error("INSUFFICIENT_BALANCE");
    }

    const after = before - amount;

    console.log("💰 [WALLET][DEBIT][CALC]", {
      before,
      amount,
      after,
    });

    /* ================= IDEMPOTENT ================= */

    const insert = await client.query(
      `
      INSERT INTO wallet_transactions (
        user_id,
        type,
        amount,
        reference_type,
        reference_id,
        idempotency_key,
        balance_before,
        balance_after
      )
      VALUES ($1,'debit',$2,'order',$3,$4,$5,$6)
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id
      `,
      [userId, amount, referenceId, idempotencyKey, before, after]
    );

    if (insert.rowCount === 0) {
      console.warn("⚠️ [WALLET][DEBIT] DUPLICATE IGNORED", {
        idempotencyKey,
      });
      return;
    }

    /* ================= UPDATE ================= */

    await client.query(
      `
      UPDATE wallets
      SET balance = $1,
          updated_at = now()
      WHERE user_id = $2
      `,
      [after, userId]
    );

    console.log("🟢 [WALLET][DEBIT] SUCCESS", {
      userId,
      amount,
      after,
    });
  });
}

/* =====================================================
   PAY WITH WALLET (ORDER FLOW)
===================================================== */

export async function payWithWallet(params: {
  userId: string;
  orderId: string;
}) {
  const { userId, orderId } = params;

  if (!isValidUuid(userId) || !isValidUuid(orderId)) {
    error("INVALID_INPUT");
  }

  console.log("🟡 [WALLET][PAY ORDER] START", {
    userId,
    orderId,
  });

  return withTransaction(async (client) => {
    /* ================= LOCK ORDER ================= */

    const { rows } = await client.query<OrderRow>(
      `
      SELECT total_amount, status
      FROM orders
      WHERE id = $1 AND buyer_id = $2
      FOR UPDATE
      `,
      [orderId, userId]
    );

    const order = rows[0];

    if (!order) error("ORDER_NOT_FOUND");

    if (order.status !== "pending") {
      error("INVALID_STATE");
    }

    const amount = toNumberSafe(order.total_amount, "total_amount");

    console.log("💰 [ORDER][PAY]", {
      orderId,
      amount,
    });

    /* ================= DEBIT ================= */

    await debitWallet({
      userId,
      amount,
      referenceId: orderId,
      idempotencyKey: `order_${orderId}`,
    });

    /* ================= UPDATE ORDER ================= */

    await client.query(
      `
      UPDATE orders
      SET status = 'paid',
          updated_at = now()
      WHERE id = $1
      `,
      [orderId]
    );

    console.log("🟢 [WALLET][PAY ORDER] SUCCESS", {
      orderId,
    });
  });
}

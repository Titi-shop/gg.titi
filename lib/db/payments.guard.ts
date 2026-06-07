

import { query } from "@/lib/db";

/* =========================================================
   TYPES V7
========================================================= */

export type PaymentStatusV7 =
  | "created"
  | "wallet_opened"
  | "submitted"
  | "verifying"
  | "paid"
  | "failed"
  | "expired";

export type GuardFailCodeV7 =
  | "INVALID_UUID"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "PAYMENT_FAILED"
  | "PAYMENT_EXPIRED"
  | "ALREADY_PAID";

export type GuardResultV7 =
  | {
      ok: true;
      paymentIntentId: string;
      status: PaymentStatusV7;
      amount: number;
      buyerId: string;
      piPaymentId: string | null;
      txid: string | null;
    }
  | {
      ok: false;
      code: GuardFailCodeV7;
      reason: string;
    };

export type LockResultV7 =
  | { ok: true; lockId: string }
  | { ok: false; code: "LOCK_DENIED"; reason: string };

/* =========================================================
   HELPERS
========================================================= */

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

/* =========================================================
   GUARD READ (SOURCE OF TRUTH)
========================================================= */

export async function guardPaymentV7(
  paymentIntentId: string,
  userId: string | null,
  systemMode = false
): Promise<GuardResultV7> {
  if (!isUUID(paymentIntentId)) {
    return {
      ok: false,
      code: "INVALID_UUID",
      reason: "paymentIntentId is not a valid UUID",
    };
  }

  const rs = await query<{
    id: string;
    buyer_id: string;
    status: PaymentStatusV7;
    total_amount: string;
    pi_payment_id: string | null;
    txid: string | null;
  }>(
    `
    SELECT
      id,
      buyer_id,
      status,
      total_amount,
      pi_payment_id,
      txid
    FROM payment_intents
    WHERE id = $1
    LIMIT 1
    `,
    [paymentIntentId]
  );

  const row = rs.rows[0];

  if (!row) {
    return {
      ok: false,
      code: "NOT_FOUND",
      reason: "payment intent not found",
    };
  }

  /* =====================================================
     OWNER CHECK
  ===================================================== */

  if (!systemMode) {
    if (!userId || row.buyer_id !== userId) {
      return {
        ok: false,
        code: "FORBIDDEN",
        reason: "user does not own this payment intent",
      };
    }
  }

  /* =====================================================
     STATE VALIDATION
  ===================================================== */

  if (row.status === "failed") {
    return {
      ok: false,
      code: "PAYMENT_FAILED",
      reason: "payment already failed",
    };
  }

  if (row.status === "expired") {
    return {
      ok: false,
      code: "PAYMENT_EXPIRED",
      reason: "payment expired",
    };
  }

  if (row.status === "paid") {
    return {
      ok: false,
      code: "ALREADY_PAID",
      reason: "payment already completed",
    };
  }

  /* =====================================================
     SUCCESS
  ===================================================== */

  return {
    ok: true,
    paymentIntentId: row.id,
    status: row.status,
    amount: Number(row.total_amount),
    buyerId: row.buyer_id,
    piPaymentId: row.pi_payment_id,
    txid: row.txid,
  };
}

/* =========================================================
   SETTLEMENT LOCK V7 (ATOMIC)
========================================================= */

export async function acquirePaymentLockV7(
  paymentIntentId: string
): Promise<LockResultV7> {
  if (!isUUID(paymentIntentId)) {
    return {
      ok: false,
      code: "LOCK_DENIED",
      reason: "invalid uuid",
    };
  }

  const rs = await query(
    `
    UPDATE payment_intents
    SET
      settlement_lock_id = gen_random_uuid(),
      settlement_locked_at = now()
    WHERE id = $1
      AND status IN ('submitted','verifying')
      AND (
        settlement_locked_at IS NULL
        OR settlement_locked_at < now() - interval '2 minutes'
      )
    RETURNING settlement_lock_id
    `,
    [paymentIntentId]
  );

  const lockId = rs.rows[0]?.settlement_lock_id;

  if (!lockId) {
    return {
      ok: false,
      code: "LOCK_DENIED",
      reason: "lock already held or invalid state",
    };
  }

  return {
    ok: true,
    lockId,
  };
}

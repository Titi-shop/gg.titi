import { withTransaction } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

type MarkPaymentVerifyingInput = {
  paymentIntentId: string;
  userId: string;
  piPaymentId: string;
  txid: string;
};

type PaymentIntentRow = {
  id: string;
  buyer_id: string;
  status: string;
  pi_user_uid: string | null;
  pi_payment_id: string | null;
  txid: string | null;
};

/* =========================================================
   MAIN
========================================================= */

export async function markPaymentVerifying({
  paymentIntentId,
  userId,
  piPaymentId,
  txid,
}: MarkPaymentVerifyingInput): Promise<{
  ok: true;
  already: boolean;
  status: string;
  paymentIntentId: string;
}> {
  return withTransaction(async (client) => {
    console.log("[PAYMENT][SUBMIT] START", {
      paymentIntentId,
      userId,
      piPaymentId,
      txid,
    });

    /* =====================================================
       1. LOCK INTENT
    ===================================================== */

    const rs = await client.query<PaymentIntentRow>(
      `
      SELECT
        id,
        buyer_id,
        status,
        pi_user_uid,
        pi_payment_id,
        txid
      FROM payment_intents
      WHERE id = $1
      FOR UPDATE
      `,
      [paymentIntentId]
    );

    if (!rs.rows.length) {
      throw new Error("INTENT_NOT_FOUND");
    }

    const intent = rs.rows[0];

    if (intent.buyer_id !== userId) {
      throw new Error("FORBIDDEN");
    }

    console.log("[PAYMENT][SUBMIT] INTENT_OK", {
      status: intent.status,
      existingPiPaymentId: intent.pi_payment_id,
      existingTxid: intent.txid,
    });

    /* =====================================================
       2. TERMINAL STATES
    ===================================================== */

    if (intent.status === "paid") {
      return {
        ok: true,
        already: true,
        status: "paid",
        paymentIntentId,
      };
    }

    if (intent.status === "failed" || intent.status === "expired") {
      throw new Error("INVALID_STATUS");
    }

    /* =====================================================
       3. VERIFYING IDEMPOTENT / REPLAY SAFE
    ===================================================== */

    if (intent.status === "verifying") {
      const samePi =
        (intent.pi_payment_id || "").trim() === piPaymentId.trim();

      const sameTx =
        (intent.txid || "").trim() === txid.trim();

      if (samePi && sameTx) {
        return {
          ok: true,
          already: true,
          status: "verifying",
          paymentIntentId,
        };
      }

      throw new Error("REPLAY_DETECTED");
    }

    /* =====================================================
       4. ALLOWED ENTRY STATES
    ===================================================== */

    const allowedStatus = [
      "created",
      "wallet_opened",
      "submitted",
    ];

    if (!allowedStatus.includes(intent.status)) {
      throw new Error("INVALID_STATUS");
    }

    /* =====================================================
       5. PI UID REQUIRED
    ===================================================== */

    if (!intent.pi_user_uid || typeof intent.pi_user_uid !== "string") {
      throw new Error("PI_UID_NOT_BOUND");
    }

    /* =====================================================
       6. GLOBAL REPLAY PROTECTION
    ===================================================== */

    const dup = await client.query(
      `
      SELECT id
      FROM payment_intents
      WHERE (pi_payment_id = $1 OR txid = $2)
        AND id <> $3
      LIMIT 1
      `,
      [piPaymentId, txid, paymentIntentId]
    );

    if (dup.rows.length) {
      throw new Error("REPLAY_DETECTED");
    }

    /* =====================================================
       7. UPDATE ONLY SUBMIT SNAPSHOT
       NOTE:
       submit layer MUST NOT create settlement execution lock.
       orchestrator reconcile owns settlement locking.
    ===================================================== */

    await client.query(
      `
      UPDATE payment_intents
      SET
        status = 'verifying',
        settlement_state = 'UNSETTLED',
        pi_payment_id = $2,
        txid = $3,
        reconcile_attempts = reconcile_attempts + 1,
        last_reconcile_at = now(),
        updated_at = now()
      WHERE id = $1
      `,
      [paymentIntentId, piPaymentId, txid]
    );

    console.log("[PAYMENT][SUBMIT] VERIFYING_SET", {
      paymentIntentId,
      piPaymentId,
      txid,
    });

    return {
      ok: true,
      already: false,
      status: "verifying",
      paymentIntentId,
    };
  });
}

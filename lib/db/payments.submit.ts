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
  payment_state: string | null;
  provider_status: string | null;
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

    const rs =
  await client.query<PaymentIntentRow>(
    `
    SELECT
      id,
      buyer_id,

      status,
      payment_state,
      provider_status,

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
console.log(
  "[PAYMENT][SUBMIT] CURRENT_STATE",
  {
    status: intent.status,
    payment_state:
      intent.payment_state,
    provider_status:
      intent.provider_status,
    pi_payment_id:
      intent.pi_payment_id,
    txid: intent.txid,
  }
);
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
if (
  intent.pi_payment_id &&
  intent.pi_payment_id !== piPaymentId
) {
  console.error(
    "[PAYMENT][SUBMIT] PI_PAYMENT_MISMATCH",
    {
      expected:
        intent.pi_payment_id,
      received:
        piPaymentId,
    }
  );

  throw new Error(
    "PI_PAYMENT_MISMATCH"
  );
}

if (
  intent.txid &&
  intent.txid !== txid
) {
  console.error(
    "[PAYMENT][SUBMIT] TXID_MISMATCH",
    {
      expected:
        intent.txid,
      received:
        txid,
    }
  );

  throw new Error(
    "TXID_MISMATCH"
  );
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
  console.error(
    "[PAYMENT][SUBMIT] GLOBAL_REPLAY",
    {
      paymentIntentId,
      piPaymentId,
      txid,
    }
  );

  throw new Error(
    "REPLAY_DETECTED"
  );
}

    /* =====================================================
       7. UPDATE ONLY SUBMIT SNAPSHOT
       NOTE:
       submit layer MUST NOT create settlement execution lock.
       orchestrator reconcile owns settlement locking.
    ===================================================== */

    const update =
  await client.query(
    `
    UPDATE payment_intents
    SET
      status = 'verifying',

      payment_state =
        'SUBMITTED',

      provider_status =
        'TX_BROADCASTED',

      settlement_state =
        'UNSETTLED',

      pi_payment_id = $2,
      txid = $3,

      reconcile_attempts =
        reconcile_attempts + 1,

      last_reconcile_at =
        now(),

      updated_at = now()

    WHERE id = $1
      AND status IN (
        'created',
        'wallet_opened',
        'submitted'
      )
    `,
    [
      paymentIntentId,
      piPaymentId,
      txid,
    ]
  );

if (!update.rowCount) {
  console.error(
    "[PAYMENT][SUBMIT] STATUS_CHANGED",
    {
      paymentIntentId,
    }
  );

  throw new Error(
    "STATUS_CHANGED"
  );
}

console.log(
  "[PAYMENT][SUBMIT] UPDATE_OK",
  {
    paymentIntentId,
    status: "verifying",
    payment_state:
      "SUBMITTED",
    provider_status:
      "TX_BROADCASTED",
  }
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

import type { PoolClient } from "pg";

import type {
  UpsertPiPaymentInput,
} from "./orders.payment.types";
function logPiPayment(
  event: string,
  payload: Record<string, unknown>
): void {
  console.log(
    `[PAYMENT][PI_PAYMENTS] ${event}`,
    payload
  );
}

function logPiPaymentFail(
  event: string,
  payload: Record<string, unknown>
): void {
  console.error(
    `[PAYMENT][PI_PAYMENTS][FAIL] ${event}`,
    payload
  );
}
export async function upsertPiPayment(
  client: PoolClient,
  input: UpsertPiPaymentInput
): Promise<void> {
  const {
    paymentIntentId,
    orderId,

    buyerId,

    piPaymentId,
    txid,

    expectedAmount,
    verifiedAmount,

    receiverWallet,

    country,
    zone,

    piPayload,
    rpcPayload,
  } = input;
logPiPayment(
  "UPSERT_START",
  {
    paymentIntentId,
    orderId,
    buyerId,
    piPaymentId,
    txid,
    expectedAmount,
    verifiedAmount,
    receiverWallet,
  }
);

if (!paymentIntentId) {
  logPiPaymentFail(
    "PAYMENT_INTENT_ID_REQUIRED",
    {}
  );

  throw new Error(
    "PAYMENT_INTENT_ID_REQUIRED"
  );
}

if (!orderId) {
  throw new Error(
    "ORDER_ID_REQUIRED"
  );
}

if (!buyerId) {
  throw new Error(
    "BUYER_ID_REQUIRED"
  );
}

if (!piPaymentId) {
  throw new Error(
    "PI_PAYMENT_ID_REQUIRED"
  );
}

if (!txid) {
  throw new Error(
    "TXID_REQUIRED"
  );
}
  if (
  rpcPayload.chainReference &&
  rpcPayload.chainReference !== txid
) {
  throw new Error(
    "CHAIN_REFERENCE_MISMATCH"
  );
}

if (
  rpcPayload.amount != null &&
  Number(rpcPayload.amount) !==
    Number(verifiedAmount)
) {
  throw new Error(
    "RPC_AMOUNT_MISMATCH"
  );
}

if (
  rpcPayload.receiver &&
  rpcPayload.receiver
    .trim()
    .toLowerCase() !==
    receiverWallet
      .trim()
      .toLowerCase()
) {
  throw new Error(
    "RPC_RECEIVER_MISMATCH"
  );
}
  logPiPayment(
  "UPSERT_PAYLOAD",
  {
    paymentIntentId,
    orderId,
    buyerId,
    expectedAmount,
    verifiedAmount,
    txid,
    ledger:
      rpcPayload.ledger,
    txStatus:
      rpcPayload.txStatus,
    chainReference:
      rpcPayload.chainReference,
    receiverWallet,
  }
);
  try {
  const result =
  await client.query(
    `
    INSERT INTO pi_payments (
      payment_intent_id,
      order_id,
      user_id,

      pi_payment_id,
      txid,
      receiver_wallet,

      amount,
      expected_amount,
      verified_amount,
      currency,

      status,

      reconcile_attempts,
      last_reconcile_at,

      payment_nonce,
      verify_token,
      idempotency_key,

      country,
      zone,

      failure_reason,
      manual_review_reason,
      note,

      processing_lock_id,
      processing_locked_at,

      pi_raw_payload,
      rpc_raw_payload,
      complete_raw_payload,

      completed_at,
      created_at,
      updated_at
    )
    VALUES (
      $1,$2,$3,
      $4,$5,$6,
      $7,$8,$9,$10,
      $11,
      $12,$13,
      $14,$15,$16,
      $17,$18,
      $19,$20,$21,
      $22,$23,
      $24,$25,$26,
      $27,$28,$29
    )
    ON CONFLICT (pi_payment_id)
    DO UPDATE SET

      order_id =
        COALESCE(
          EXCLUDED.order_id,
          pi_payments.order_id
        ),

      user_id =
        COALESCE(
          EXCLUDED.user_id,
          pi_payments.user_id
        ),

      txid =
        COALESCE(
          EXCLUDED.txid,
          pi_payments.txid
        ),

      receiver_wallet =
        COALESCE(
          EXCLUDED.receiver_wallet,
          pi_payments.receiver_wallet
        ),

      amount =
        COALESCE(
          EXCLUDED.amount,
          pi_payments.amount
        ),

      expected_amount =
        COALESCE(
          EXCLUDED.expected_amount,
          pi_payments.expected_amount
        ),

      verified_amount =
        COALESCE(
          EXCLUDED.verified_amount,
          pi_payments.verified_amount
        ),

      status =
        COALESCE(
          EXCLUDED.status,
          pi_payments.status
        ),

      reconcile_attempts =
        pi_payments.reconcile_attempts + 1,

      last_reconcile_at =
        now(),

      failure_reason =
        COALESCE(
          EXCLUDED.failure_reason,
          pi_payments.failure_reason
        ),

      manual_review_reason =
        EXCLUDED.manual_review_reason,

      note =
        EXCLUDED.note,

      processing_lock_id =
        EXCLUDED.processing_lock_id,

      processing_locked_at =
        EXCLUDED.processing_locked_at,

      pi_raw_payload =
        COALESCE(
          EXCLUDED.pi_raw_payload,
          pi_payments.pi_raw_payload
        ),

      rpc_raw_payload =
        COALESCE(
          EXCLUDED.rpc_raw_payload,
          pi_payments.rpc_raw_payload
        ),

      complete_raw_payload =
        COALESCE(
          EXCLUDED.complete_raw_payload,
          pi_payments.complete_raw_payload
        ),

      completed_at =
        COALESCE(
          pi_payments.completed_at,
          EXCLUDED.completed_at
        ),

      updated_at =
        now()
    `,
    [
      paymentIntentId,
      orderId,
      buyerId,

      piPaymentId,
      txid,
      receiverWallet,

      verifiedAmount,
      expectedAmount,
      verifiedAmount,

      "PI",

      "SETTLED",

      1,
      new Date(),

      piPayload.identifier ?? null,

      rpcPayload.chainReference ??
        txid,

      paymentIntentId,

      country,
      zone,

      rpcPayload.reason ?? null,

      rpcPayload.reason ??
        (
          rpcPayload.ok
            ? "NONE"
            : "RPC_FAILED"
        ),

      JSON.stringify({
        memo:
          piPayload.memo ??
          null,

        identifier:
          piPayload.identifier ??
          null,

        network:
          piPayload.network ??
          null,

        amount:
          piPayload.amount ??
          verifiedAmount,

        txid,
      }),

      paymentIntentId,

      new Date(),

      JSON.stringify(
        piPayload
      ),

      JSON.stringify(
        rpcPayload
      ),

      JSON.stringify({
        pi: piPayload,
        rpc: rpcPayload,
        finalized: true,
      }),

      new Date(),
      new Date(),
      new Date(),
    ]
  );
  logPiPayment(

    "UPSERT_SUCCESS",

    {

      paymentIntentId,
      orderId,
      piPaymentId,
      txid,
      rowCount: result.rowCount,
    }

  );

} catch (error) {
  logPiPaymentFail(
    "UPSERT_FAILED",

    {

      paymentIntentId,
      orderId,
      piPaymentId,
      txid,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    }
  );
  throw error;
}
}

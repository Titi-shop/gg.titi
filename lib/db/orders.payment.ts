
import { withTransaction } from "@/lib/db";
import { createOrder } from "@/lib/db/orders.create";
import {
  auditManualReview,
  writePaymentAudit,
} from "@/lib/db/payments.audit";

import type {
  FinalizePaidOrderParams,
  FinalizePaidOrderResult,
  PaymentIntentRow,
} from "@/lib/payments/types";

/* =========================================================
   HELPERS
========================================================= */

function toNumber(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new Error("INVALID_NUMBER");
  }
  return n;
}

function isSameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0000001;
}

/* =========================================================
   FINALIZER
========================================================= */

export async function finalizePaidOrderFromIntent({
  paymentIntentId,
  piPaymentId,
  txid,
  verifiedAmount,
  receiverWallet,
  piPayload,
  rpcPayload,
  intent, 
}: FinalizePaidOrderParams & { intent: PaymentIntentRow }) {
  return withTransaction(async (client) => {
    /* =====================================================
       1. LOCK PAYMENT INTENT
    ===================================================== */

const rawShipping =
  typeof intent.shipping_snapshot === "string"
    ? JSON.parse(intent.shipping_snapshot)
    : intent.shipping_snapshot;

const shipping: ShippingSnapshot =
  rawShipping?.buyer_shipping ?? rawShipping ?? {};

if (
  !shipping.name ||
  !shipping.phone ||
  !shipping.address_line
) {
  await auditManualReview(
  paymentIntentId,
  "INVALID_SHIPPING_SNAPSHOT",
  {
    shipping,
  },
  client
);

  throw new Error("INVALID_SHIPPING_SNAPSHOT");
}
    /* =====================================================
       2. IDEMPOTENT IF ALREADY PAID
    ===================================================== */

    if (intent.status === "paid") {
      const existedOrder = await client.query<{ id: string }>(
        `
        SELECT id
        FROM orders
        WHERE pi_payment_id = $1
        LIMIT 1
        `,
        [piPaymentId]
      );

      return {
        ok: true,
        already: true,
        orderId: existedOrder.rows[0]?.id ?? null,
        buyerId: intent.buyer_id,
        sellerId: intent.seller_id,
        amount: verifiedAmount,
      };
    }

    if (
      intent.status !== "verifying" &&
      intent.status !== "submitted" &&
      intent.status !== "wallet_opened"
    ) {
      throw new Error("INVALID_PAYMENT_STATUS");
    }

    /* =====================================================
       3. STRICT AMOUNT + RECEIVER VALIDATION
    ===================================================== */

    const expectedAmount = toNumber(intent.total_amount);

    if (!isSameAmount(expectedAmount, verifiedAmount)) {
      await auditManualReview(paymentIntentId, "AMOUNT_MISMATCH", {
        expectedAmount,
        verifiedAmount,
      });
      throw new Error("AMOUNT_MISMATCH");
    }

    if (
      String(intent.merchant_wallet || "").trim().toLowerCase() !==
      String(receiverWallet || "").trim().toLowerCase()
    ) {
      await auditManualReview(paymentIntentId, "RECEIVER_MISMATCH", {
        expected: intent.merchant_wallet,
        got: receiverWallet,
      });
      throw new Error("RECEIVER_MISMATCH");
    }

/* =====================================================
   4. CREATE ORDER
===================================================== */

await writePaymentAudit({
  paymentIntentId,
  eventCode: "ORDER_FINALIZE_STARTED",
  stage: "FINALIZE",
  actorType: "system",
  piPaymentId,
  txid,
  source: "orders.payment",
  newSettlementState: "FINALIZING_ORDER",
  payload: {
    verifiedAmount,
    receiverWallet,
  },
});

const createdOrder = await createOrder({
  userId: intent.buyer_id,

  piPaymentId,
  txid,
  idempotencyKey: paymentIntentId, // hoặc intent.id

  country: intent.country,
  zone: intent.zone,

  shipping: {
    name: shipping.name ?? "",
    phone: shipping.phone ?? "",
    address_line: shipping.address_line ?? "",
    ward: shipping.ward ?? null,
    district: shipping.district ?? null,
    region: shipping.region ?? null,
    postal_code: shipping.postal_code ?? null,
  },

  items: [
    {
      product_id: intent.product_id,
      variant_id: intent.variant_id,
      quantity: intent.quantity,
    },
  ],
});

const orderId = createdOrder.orderId;

if (!orderId) {
  throw new Error("ORDER_CREATE_FAILED");
}

await writePaymentAudit({
  paymentIntentId,
  eventCode: "ORDER_CREATED",
  stage: "FINALIZE",
  actorType: "system",
  piPaymentId,
  txid,
  source: "orders.payment",
  orderId,
  newSettlementState: "ORDER_CREATED",
});
    /* =====================================================
       6. CREATE PAYMENT RECEIPT
    ===================================================== */

    await client.query(
  `
  INSERT INTO payment_receipts (
    payment_intent_id,
    user_id,
    order_id,
    escrow_id,

    pi_payment_id,
    pi_uid,
    txid,

    expected_amount,
    verified_amount,
    currency,

    sender_wallet,
    receiver_wallet,

    verification_status,
    verify_source,
    settlement_state,

    rpc_confirmed,
    rpc_ledger,
    chain_reference,

    tx_status,
    developer_completed,
    rpc_reason,

    pi_payload,
    rpc_payload,
    merged_payload,

    developer_completed_at,

    pi_created_at,
    pi_memo,

    rpc_tx_status,
    rpc_stage,

    idempotency_key,

    verified_at,
    completed_at,
    created_at,
    updated_at
  )
  VALUES (
    $1,$2,$3,$4,
    $5,$6,$7,
    $8,$9,$10,
    $11,$12,
    $13,$14,$15,
    $16,$17,$18,
    $19,$20,$21,
    $22,$23,$24,
    $25,
    $26,$27,
    $28,$29,
    $30,
    now(),now(),now(),now()
  )
  ON CONFLICT (pi_payment_id)
  DO UPDATE SET
    order_id = EXCLUDED.order_id,
    escrow_id = EXCLUDED.escrow_id,

    pi_uid = EXCLUDED.pi_uid,

    sender_wallet = EXCLUDED.sender_wallet,
    receiver_wallet = EXCLUDED.receiver_wallet,

    rpc_confirmed = EXCLUDED.rpc_confirmed,
    rpc_ledger = EXCLUDED.rpc_ledger,
    chain_reference = EXCLUDED.chain_reference,

    tx_status = EXCLUDED.tx_status,
    developer_completed = EXCLUDED.developer_completed,
    rpc_reason = EXCLUDED.rpc_reason,

    pi_payload = EXCLUDED.pi_payload,
    rpc_payload = EXCLUDED.rpc_payload,
    merged_payload = EXCLUDED.merged_payload,

    pi_created_at = EXCLUDED.pi_created_at,
    pi_memo = EXCLUDED.pi_memo,

    rpc_tx_status = EXCLUDED.rpc_tx_status,
    rpc_stage = EXCLUDED.rpc_stage,

    verification_status = EXCLUDED.verification_status,
    verify_source = EXCLUDED.verify_source,
    settlement_state = EXCLUDED.settlement_state,

    developer_completed_at =
      EXCLUDED.developer_completed_at,

    verified_at = now(),
    completed_at = now(),
    updated_at = now()
  `,
  [
    /* $1 */
    paymentIntentId,

    /* $2 */
    intent.buyer_id,

    /* $3 */
    orderId,

    /* $4 */
    null,

    /* $5 */
    piPaymentId,

    /* $6 */
    piPayload?.user_uid ?? null,

    /* $7 */
    txid,

    /* $8 */
    expectedAmount,

    /* $9 */
    verifiedAmount,

    /* $10 */
    "PI",

    /* $11 */
    piPayload?.from_address ?? null,

    /* $12 */
    piPayload?.to_address ?? receiverWallet,

    /* $13 */
    "completed",

    /* $14 */
    "DUAL_AUDIT",

    /* $15 */
    "ORDER_FINALIZED",

    /* $16 */
    rpcPayload?.confirmed ?? rpcPayload?.ok ?? false,

    /* $17 */
    rpcPayload?.ledger ?? null,

    /* $18 */
    rpcPayload?.chainReference ?? txid,

    /* $19 */
    rpcPayload?.txStatus ??
(rpcPayload?.confirmed ? "CONFIRMED" : "UNCONFIRMED"),

    /* $20 */
    piPayload?.status?.developer_completed ?? false,

    /* $21 */
    rpcPayload?.reason ?? "NONE",

    /* $22 */
    JSON.stringify({
      memo: piPayload?.memo ?? null,
      amount: piPayload?.amount ?? verifiedAmount,
      network: piPayload?.network ?? null,
      identifier: piPayload?.identifier ?? null,
      txid: piPayload?.transaction?.txid ?? txid,
      verified: piPayload?.transaction?.verified ?? true,
      created_at: piPayload?.created_at ?? null,
    }),

    /* $23 */
    JSON.stringify({
      ok: rpcPayload?.ok ?? false,
      amount: rpcPayload?.amount ?? verifiedAmount,
      ledger: rpcPayload?.ledger ?? null,
      sender: rpcPayload?.sender ?? null,
      receiver: rpcPayload?.receiver ?? null,
      confirmed: rpcPayload?.confirmed ?? true,
      txStatus: rpcPayload?.txStatus ?? "CONFIRMED",
      reason: rpcPayload?.reason ?? "NONE",
    }),

    /* $24 */
    JSON.stringify({
      pi_summary: {
        amount:
          piPayload?.amount ?? verifiedAmount,

        memo:
          piPayload?.memo ?? null,

        developer_completed:
          piPayload?.status
            ?.developer_completed ?? false,
      },

      rpc_summary: {
        ok: rpcPayload?.ok ?? false,

        ledger:
          rpcPayload?.ledger ?? null,

        txStatus:
          rpcPayload?.txStatus ??
          "CONFIRMED",
      },
    }),

    /* $25 */
    piPayload?.status?.developer_completed
      ? new Date()
      : null,

    /* $26 */
    piPayload?.created_at
  ? new Date(piPayload.created_at)
  : null,

    /* $27 */
    piPayload?.memo ?? null,

    /* $28 */
    rpcPayload?.txStatus ?? "CONFIRMED",

    /* $29 */
    rpcPayload?.stage ?? null,

    /* $30 */
    paymentIntentId,
  ]
);
    
    /* =====================================================
   7. UPSERT PI PAYMENTS (FIXED FULL)
===================================================== */

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

    order_id = COALESCE(EXCLUDED.order_id, pi_payments.order_id),
    user_id = COALESCE(EXCLUDED.user_id, pi_payments.user_id),

    txid = COALESCE(EXCLUDED.txid, pi_payments.txid),
    receiver_wallet = COALESCE(EXCLUDED.receiver_wallet, pi_payments.receiver_wallet),

    amount = COALESCE(EXCLUDED.amount, pi_payments.amount),
    expected_amount = COALESCE(EXCLUDED.expected_amount, pi_payments.expected_amount),
    verified_amount = COALESCE(EXCLUDED.verified_amount, pi_payments.verified_amount),

    status = COALESCE(EXCLUDED.status, pi_payments.status),

    reconcile_attempts = pi_payments.reconcile_attempts + 1,
    last_reconcile_at = now(),

    failure_reason = COALESCE(EXCLUDED.failure_reason, pi_payments.failure_reason),

    manual_review_reason = EXCLUDED.manual_review_reason,
    note = EXCLUDED.note,

    processing_lock_id = EXCLUDED.processing_lock_id,
    processing_locked_at = EXCLUDED.processing_locked_at,

    pi_raw_payload = COALESCE(EXCLUDED.pi_raw_payload, pi_payments.pi_raw_payload),
    rpc_raw_payload = COALESCE(EXCLUDED.rpc_raw_payload, pi_payments.rpc_raw_payload),
    complete_raw_payload = COALESCE(EXCLUDED.complete_raw_payload, pi_payments.complete_raw_payload),

    completed_at = COALESCE(pi_payments.completed_at, EXCLUDED.completed_at),
    updated_at = now()
  `,
  [
    /* $1 */ paymentIntentId,
    /* $2 */ orderId,
    /* $3 */ intent.buyer_id,

    /* $4 */ piPaymentId,
    /* $5 */ txid,
    /* $6 */ receiverWallet,

    /* $7 */ verifiedAmount,
    /* $8 */ expectedAmount,
    /* $9 */ verifiedAmount,
    /* $10 */ "PI",

    /* $11 */ "SETTLED",

    /* $12 */ 1,
    /* $13 */ new Date(),

    /* $14 */ piPayload?.identifier ?? null,
    /* $15 */ rpcPayload?.chainReference ?? txid,
    /* $16 */ paymentIntentId,

    /* $17 */ intent.country ?? null,
    /* $18 */ intent.zone ?? null,

    /* $19 */ rpcPayload?.reason ?? null,

    /* $20 */
    rpcPayload?.reason ?? (rpcPayload?.ok ? "NONE" : "RPC_FAILED"),

    /* $21 */
    JSON.stringify({
      memo: piPayload?.memo ?? null,
      identifier: piPayload?.identifier ?? null,
      network: piPayload?.network ?? null,
      amount: piPayload?.amount ?? verifiedAmount,
      txid,
    }),

    /* $22 */
    paymentIntentId, // processing_lock_id

    /* $23 */
    new Date(), // processing_locked_at

    /* $24 */
    JSON.stringify(piPayload),

    /* $25 */
    JSON.stringify(rpcPayload),

    /* $26 */
    JSON.stringify({
      pi: piPayload,
      rpc: rpcPayload,
      finalized: true,
    }),

    /* $27 */
    new Date(),

    /* $28 */
    new Date(),

    /* $29 */
    new Date(),
  ]
);

    /* =====================================================
       8. FINALIZE PAYMENT INTENT
    ===================================================== */

    await client.query(
      `
      UPDATE payment_intents
      SET
        status = 'paid',
        settlement_state = 'SETTLED',
        pi_payment_id = $2,
        txid = $3,
        paid_at = now(),
        updated_at = now()
      WHERE id = $1
      `,
      [paymentIntentId, piPaymentId, txid]
    );

    /* =====================================================
       9. RETURN
    ===================================================== */

    return {
      ok: true,
      already: false,
      orderId,
      buyerId: intent.buyer_id,
      sellerId: intent.seller_id,
      amount: verifiedAmount,
    };
  });
}

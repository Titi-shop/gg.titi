
import { query } from "@/lib/db";
import { createHash } from "crypto";

import type {
  AuditSeverity,
  AuditStage,
  AuditActorType,
  WriteAuditParams,
  AuditPiVerifiedParams,
  AuditRpcVerifiedParams,
  AuditPiCompletedParams,
} from "@/lib/payments/types";

/* =========================================================
   HELPERS
========================================================= */

function safeString(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function safeJson(v: unknown): JsonValue {
  if (v === undefined || v === null) return {};
  return v as JsonValue;
}

/* =========================================================
   FOR FORENSIC HASH (DETERMINISTIC)
========================================================= */

function makeHash(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

/* =========================================================
   GET PREVIOUS HASH (CHAIN)
========================================================= */

async function getPreviousHash(paymentIntentId: string): Promise<string | null> {
  const rs = await query<{ event_hash: string }>(
    `
    SELECT event_hash
    FROM payment_audit_logs
    WHERE payment_intent_id = $1
    ORDER BY event_index DESC
    LIMIT 1
    `,
    [paymentIntentId]
  );

  return rs.rows[0]?.event_hash ?? null;
}

/* =========================================================
   CORE WRITER
========================================================= */

export async function writePaymentAudit(
  params: WriteAuditParams
): Promise<void> {
  const prevHash = await getPreviousHash(params.paymentIntentId);

  const normalized = {
    paymentIntentId: params.paymentIntentId,

    eventCode: params.eventCode,
    stage: params.stage,
    severity: params.severity ?? "info",

    actorType: params.actorType ?? "system",
    actorId: params.actorId ?? null,

    source: safeString(params.source) ?? "unknown",
    requestId:
      safeString(params.requestId) ??
      safeString(params.paymentIntentId),

    orderId: safeString(params.orderId),
    escrowId: safeString(params.escrowId),

    piPaymentId: safeString(params.piPaymentId),
    txid: safeString(params.txid),

    oldPaymentStatus: params.oldPaymentStatus ?? null,
    newPaymentStatus: params.newPaymentStatus ?? null,

    oldSettlementState: params.oldSettlementState ?? null,
    newSettlementState: params.newSettlementState ?? null,

    reconcileAttempt: params.reconcileAttempt ?? 0,

    note: params.note ?? null,
    payload: safeJson(params.payload),

    prevHash,
  };

  /* =========================================================
     FORENSIC CHAIN HASH (FIXED - NO RANDOM)
  ========================================================= */

  const eventHash = makeHash({
    paymentIntentId: normalized.paymentIntentId,
    eventCode: normalized.eventCode,
    stage: normalized.stage,
    severity: normalized.severity,

    actorType: normalized.actorType,
    actorId: normalized.actorId,

    source: normalized.source,
    requestId: normalized.requestId,

    orderId: normalized.orderId,
    escrowId: normalized.escrowId,

    piPaymentId: normalized.piPaymentId,
    txid: normalized.txid,

    oldPaymentStatus: normalized.oldPaymentStatus,
    newPaymentStatus: normalized.newPaymentStatus,

    oldSettlementState: normalized.oldSettlementState,
    newSettlementState: normalized.newSettlementState,

    reconcileAttempt: normalized.reconcileAttempt,

    note: normalized.note,
    payload: normalized.payload,

    prevHash,
  });

  await query(
    `
    INSERT INTO payment_audit_logs (
      payment_intent_id,
      order_id,
      escrow_id,
      pi_payment_id,
      txid,

      event_code,
      stage,
      severity,

      actor_type,
      actor_id,
      source,
      request_id,

      old_payment_status,
      new_payment_status,

      old_settlement_state,
      new_settlement_state,

      reconcile_attempt,

      note,
      payload,

      prev_hash,
      event_hash
    )
    VALUES (
      $1,$2,$3,$4,$5,
      $6,$7,$8,
      $9,$10,$11,$12,
      $13,$14,
      $15,$16,
      $17,
      $18,$19,
      $20,$21
    )
    `,
    [
      normalized.paymentIntentId,
      normalized.orderId,
      normalized.escrowId,
      normalized.piPaymentId,
      normalized.txid,

      normalized.eventCode,
      normalized.stage,
      normalized.severity,

      normalized.actorType,
      normalized.actorId,
      normalized.source,
      normalized.requestId,

      normalized.oldPaymentStatus,
      normalized.newPaymentStatus,

      normalized.oldSettlementState,
      normalized.newSettlementState,

      normalized.reconcileAttempt,

      normalized.note,
      JSON.stringify(normalized.payload),

      prevHash,
      eventHash,
    ]
  );
}

/* =========================================================
   PRESET HELPERS
========================================================= */

export const auditPiVerified = (
  paymentIntentId: string,
  params: AuditPiVerifiedParams
) =>
  writePaymentAudit({
    paymentIntentId,
    eventCode: "PI_VERIFIED",
    stage: "PI_VERIFY",
    actorType: "pi_api",
    source: params.source,
    actorId: params.actorId,
    txid: params.txid,
    piPaymentId: params.piPaymentId,
    newSettlementState: "PI_VERIFIED",
    payload: {
      amount: params.amount,
      receiverWallet: params.receiverWallet,
      senderWallet: params.senderWallet,
    },
  });

export const auditRpcVerified = (
  paymentIntentId: string,
  params: AuditRpcVerifiedParams
) =>
  writePaymentAudit({
    paymentIntentId,
    eventCode: "RPC_VERIFIED",
    stage: "RPC_VERIFY",
    actorType: "rpc",

    source: params.source,
    txid: params.txid,
    piPaymentId: params.piPaymentId,

    newSettlementState: "RPC_VERIFIED",

    payload: {
      amount: params.amount,
      ledger: params.ledger,
      receiver: params.receiver,
      sender: params.sender,
      chainReference: params.chainReference,
    },
  });

export const auditRpcFailed = (
  paymentIntentId: string,
  payload?: JsonValue
) =>
  writePaymentAudit({
    paymentIntentId,
    eventCode: "RPC_FAILED",
    stage: "RPC_VERIFY",
    severity: "warn",
    actorType: "rpc",
    payload,
  });

export const auditPiCompleted = (
  paymentIntentId: string,
  params: AuditPiCompletedParams
) =>
  writePaymentAudit({
    paymentIntentId,
    eventCode: "PI_COMPLETED",
    stage: "PI_COMPLETE",
    actorType: "pi_api",

    source: params.source,
    txid: params.txid,
    piPaymentId: params.piPaymentId,

    newPaymentStatus: "paid",
    newSettlementState: "PI_COMPLETED",
  });

export const auditFinalizeDone = (
  paymentIntentId: string,
  params: {
    source?: string;
    orderId?: string | null;
    escrowId?: string | null;
    piPaymentId?: string | null;
    txid?: string | null;
  }
) =>
  writePaymentAudit({
    paymentIntentId,
    eventCode: "ORDER_FINALIZED",
    stage: "FINALIZE",
    actorType: "system",

    source: params.source,

    orderId: params.orderId,
    escrowId: params.escrowId,
    piPaymentId: params.piPaymentId,
    txid: params.txid,

    newPaymentStatus: "paid",
    newSettlementState: "ORDER_FINALIZED",
  });

export const auditManualReview = (
  paymentIntentId: string,
  reason: string,
  payload?: JsonValue
) =>
  writePaymentAudit({
    paymentIntentId,
    eventCode: "MANUAL_REVIEW",
    stage: "MANUAL",
    severity: "critical",
    actorType: "system",
    note: reason,
    payload,
  });
export const auditDuplicateSubmit = (
  paymentIntentId: string,
  payload?: JsonValue
) =>
  writePaymentAudit({
    paymentIntentId,
    eventCode: "DUPLICATE_SUBMIT",
    stage: "FINALIZE",
    severity: "warn",
    actorType: "system",
    payload,
  });

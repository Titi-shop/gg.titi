import type { PaymentRunSource } from "./common.types";

/* =========================================================
   AUDIT CORE TYPES
========================================================= */

export type AuditSeverity = "info" | "warn" | "error" | "critical";

export type PaymentAuditContext = {
  source: PaymentRunSource;
  severity?: AuditSeverity;
  note?: string;
  traceId?: string;
};

/* =========================================================
   AUDIT STAGE (DB LOGIC MOVE HERE)
========================================================= */

export type AuditStage =
  | "INTENT"
  | "PI_VERIFY"
  | "RPC_VERIFY"
  | "PI_COMPLETE"
  | "ORDER"
  | "FULFILLMENT"
  | "SHIPMENT"
  | "LEDGER"
  | "FINALIZE"
  | "MANUAL";

/* =========================================================
   ACTOR TYPES (MOVE FROM DB LAYER)
========================================================= */

export type AuditActorType =
  | "system"
  | "api"
  | "cron"
  | "admin"
  | "pi_api"
  | "rpc"
  | "ledger";


export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];
/* =========================================================
   WRITE PARAMS (CORE CONTRACT)
========================================================= */

export type WriteAuditParams = {
  paymentIntentId: string;

  eventCode: string;
  stage: AuditStage;

  severity?: AuditSeverity;
  actorType?: AuditActorType;
  actorId?: string | null;

  source?: string | null;
  requestId?: string | null;

  orderId?: string | null;
  escrowId?: string | null;

  piPaymentId?: string | null;
  txid?: string | null;

  oldPaymentStatus?: string | null;
  newPaymentStatus?: string | null;

  oldSettlementState?: string | null;
  newSettlementState?: string | null;

  reconcileAttempt?: number;

  note?: string | null;
  payload?: unknown;
};

/* =========================================================
   PRESET PARAMS
========================================================= */

export type AuditPiVerifiedParams = {
  source?: string;
  txid?: string;
  piPaymentId?: string;
  actorId?: string;
  amount?: number;
  receiverWallet?: string;
  senderWallet?: string;
};

export type AuditRpcVerifiedParams = {
  source?: string;
  txid?: string;
  piPaymentId?: string;
  amount?: number;
  ledger?: number | null;
  receiver?: string | null;
  sender?: string | null;
  chainReference?: string | null;
};

export type AuditPiCompletedParams = {
  source?: string;
  txid?: string;
  piPaymentId?: string;
};

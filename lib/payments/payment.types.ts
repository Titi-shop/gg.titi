/* =========================================================
   PAYMENT ENGINE V7 MASTER TYPES
   SINGLE SOURCE OF TRUTH
========================================================= */

/* =========================================================
   MONEY MODEL
========================================================= */

export type Currency = "PI";

export type Money = {
  amount: string;
  currency: Currency;
};

export type MoneyInput = string | number | bigint;

/* =========================================================
   PAYMENT RUN SOURCE
========================================================= */

export type PaymentRunSource =
  | "CLIENT_SUBMIT"
  | "RECONCILE_API"
  | "WEBHOOK"
  | "CRON_RETRY"
  | "MANUAL_ADMIN";

/* =========================================================
   PAYMENT INTENT STATUS MACHINE
========================================================= */

export type PaymentIntentStatus =
  | "pending"
  | "created"
  | "wallet_opened"
  | "submitted"
  | "verifying"
  | "paid"
  | "failed"
  | "cancelled"
  | "manual_review";

export type PaymentStateTransition =
  | { from: "pending"; to: "created" }
  | { from: "created"; to: "wallet_opened" }
  | { from: "wallet_opened"; to: "submitted" }
  | { from: "submitted"; to: "verifying" }
  | { from: "verifying"; to: "paid" }
  | { from: "verifying"; to: "failed" }
  | { from: "verifying"; to: "manual_review" }
  | { from: "created"; to: "cancelled" }
  | { from: "submitted"; to: "cancelled" };

/* =========================================================
   SETTLEMENT STATE MACHINE
========================================================= */

export type SettlementState =
  | "INIT"
  | "UNSETTLED"
  | "PI_VERIFIED"
  | "RPC_AUDITED"
  | "ORDER_CREATED"
  | "ESCROW_CREATED"
  | "SELLER_CREDITED"
  | "RELEASED"
  | "SETTLED"
  | "FAILED"
  | "MANUAL_REVIEW";

/* =========================================================
   RISK ENGINE
========================================================= */

export type PaymentRiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "BLOCKED";

/* =========================================================
   COMMON IDENTITY GRAPH
========================================================= */

export type PaymentIdentity = {
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
  userId?: string | null;
};

/* =========================================================
   CREATE INTENT
========================================================= */

export type ShippingInput = {
  name: string;
  phone: string;
  address_line: string;
  ward?: string | null;
  district?: string | null;
  region?: string | null;
  postal_code?: string | null;
};

export type CreateIntentNormalizedInput = {
  userId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  country: string;
  zone: string;
  shipping: ShippingInput;
};

export type CreateIntentServiceResult = {
  payment_intent_id: string;
  pi_payment_id: string;
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
  to_address: string;
};

/* =========================================================
   SUBMIT VERIFYING
========================================================= */

export type SubmitPaymentBody = {
  payment_intent_id: string;
  pi_payment_id: string;
  txid: string;
};

export type SubmitPaymentNormalizedInput = {
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
  userId: string;
};

export type SubmitVerifyResult = {
  ok: boolean;
  already: boolean;
  status: PaymentIntentStatus;
  paymentIntentId: string;
};

/* =========================================================
   GUARD SYSTEM
========================================================= */

export type GuardPaymentFailCode =
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_FORBIDDEN"
  | "PAYMENT_CANCELLED"
  | "PAYMENT_FAILED"
  | "PAYMENT_ALREADY_PAID";

export type GuardPaymentResult =
  | {
      ok: true;
      status: PaymentIntentStatus;
      amount: number;
      piPaymentId: string | null;
      txid: string | null;
    }
  | {
      ok: false;
      code: GuardPaymentFailCode;
      orderId?: string | null;
      amount?: number;
    };

export type PaymentLockResult =
  | { ok: true; lockId?: string }
  | { ok: false; code: "LOCK_DENIED" };

/* =========================================================
   PI VERIFY
========================================================= */

export type PiVerifyErrorCode =
  | "PAYMENT_INTENT_NOT_FOUND"
  | "FORBIDDEN"
  | "PI_PAYMENT_ID_MISMATCH"
  | "INVALID_PAYMENT_STATE"
  | "PI_PAYMENT_CANCELLED"
  | "PI_NOT_APPROVED"
  | "PI_AMOUNT_MISMATCH"
  | "PI_RECEIVER_MISMATCH"
  | "PI_TXID_MISMATCH"
  | "PI_PAYMENT_FETCH_FAILED";

export type PiVerifyResult =
  | {
      ok: true;
      verifiedAmount: number;
      receiverWallet: string;
      piUid: string | null;
      piPayload: unknown;
    }
  | {
      ok: false;
      code: PiVerifyErrorCode;
    };

/* =========================================================
   RPC VERIFICATION
   MUST SYNC rpc_verification_logs.verify_stage
========================================================= */

export type RpcVerifyStage =
  | "RPC_FETCH"
  | "RPC_PARSE"
  | "AMOUNT_CHECK"
  | "RECEIVER_CHECK"
  | "SENDER_CHECK"
  | "CHAIN_CONFIRM"
  | "FINAL_MATCH"
  | "FAILED"
  | "MANUAL_REVIEW";

export type RpcVerifyReason =
  | "OK"
  | "RPC_UNREACHABLE"
  | "TX_NOT_CONFIRMED"
  | "AMOUNT_NOT_READABLE"
  | "AMOUNT_MISMATCH"
  | "RECEIVER_NOT_READABLE"
  | "RECEIVER_MISMATCH"
  | "SENDER_NOT_READABLE"
  | "SENDER_MISMATCH"
  | "CHAIN_LOOKUP_FAILED"
  | "UNKNOWN_RPC_ERROR";

export type RpcVerifyStatus =
  | "success"
  | "mismatch"
  | "duplicate"
  | "chain_failed"
  | "manual_review";

export type RpcAuditResult = {
  ok: boolean;
  audited: boolean;
  verified: boolean;

  amount: number | null;
  sender: string | null;
  receiver: string | null;

  ledger: number | null;
  confirmed: boolean;
  txStatus: string | null;
  chainReference: string | null;

  stage: RpcVerifyStage;
  reason: RpcVerifyReason;
  verifyStatus: RpcVerifyStatus;

  payload: unknown;
};

/* =========================================================
   VERIFIED MONEY CONTEXT
========================================================= */

export type VerifiedMoneyContext = {
  verifiedAmount: number;
  receiverWallet: string;
  piUid: string | null;
};

/* =========================================================
   FINALIZE ORDER
========================================================= */

export type FinalizePaidOrderParams = {
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
  verifiedAmount: number;
  receiverWallet: string;
  piUid?: string | null;
  piPayload: unknown;
  rpcPayload: unknown;
};

export type FinalizeOrderResult =
  | {
      ok: true;
      already?: false;
      orderId: string;
      escrowId: string;
      buyerId: string;
      sellerId: string;
    }
  | {
      ok: true;
      already: true;
      orderId: string | null;
      escrowId?: string | null;
      buyerId: string;
      sellerId: string;
    };

/* =========================================================
   ORCHESTRATOR
========================================================= */

export type RunPaymentSettlementInput = {
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
  userId?: string | null;
  source: PaymentRunSource;
};

export type PaymentSettlementResult = {
  ok: boolean;
  orderId: string | null;
  amount: number;
  piCompleted: boolean;
  rpcAudited: boolean;
  source: PaymentRunSource;
};

/* =========================================================
   AUDIT
========================================================= */

export type AuditSeverity =
  | "info"
  | "warn"
  | "error"
  | "critical";

export type PaymentAuditContext = {
  source: PaymentRunSource;
  severity?: AuditSeverity;
  note?: string;
  traceId?: string;
};

/* =========================================================
   LEDGER GRAPH
========================================================= */

export type LedgerIdentity = {
  escrowId: string;
  ledgerId?: string;
  chainTxid?: string;
};

/* =========================================================
   FULL TRACE OBJECT
========================================================= */

export type PaymentTrace = {
  identity: PaymentIdentity;

  pi: {
    verified: boolean;
    payload?: unknown;
  };

  rpc: {
    verified: boolean;
    payload?: RpcAuditResult;
  };

  settlement: {
    state: SettlementState;
    escrowId?: string;
    orderId?: string;
  };
};

export type RawInput = {
  userId: string;
  raw: unknown;
};

export type ShippingInput = {
  name: string;
  phone: string;
  address_line: string;

  ward?: string | null;
  district?: string | null;
  region?: string | null;
  postal_code?: string | null;
};

export type NormalizedIntentInput = {
  userId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  country: string;
  zone: string;
  shipping: ShippingInput;
};

export type CreateIntentServiceResult = {
  payment_intent_id: string;
  pi_payment_id: string;
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
  to_address: string;
};

export type CreatePiPaymentIntentParams = {
  userId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  country: string;
  zone: string;
  shipping: ShippingInput;
  pricing: PricingResult;
};

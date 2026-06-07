/* =========================================================
   COMMON PAYMENT TYPES
========================================================= */

export type Currency = "PI";

export type Money = {
  amount: string;
  currency: Currency;
};

export type MoneyInput =
  | string
  | number
  | bigint;

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
   PAYMENT STATUS
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

/* =========================================================
   SETTLEMENT STATE
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
   PAYMENT IDENTITY
========================================================= */

export type PaymentIdentity = {
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
  userId?: string | null;
};

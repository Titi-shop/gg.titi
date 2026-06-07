/* =========================================================
   RPC VERIFY
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

export type PaymentIntentRow = {
  id: string;
  total_amount: string;
  merchant_wallet: string | null;
};

export type RpcVerifyResult = {
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

  payload: unknown;

  reason: RpcVerifyReason;
  stage: RpcVerifyStage;

  createdAt: string | null;
  memo: string | null;
};



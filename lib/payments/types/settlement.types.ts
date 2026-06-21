import type {
  PaymentRunSource,
} from "./common.types";

/* =========================================================
   ESCROW
========================================================= */

export type CreateEscrowInput = {
  paymentIntentId: string;
  orderId: string;

  buyerId: string;
  sellerId: string;

  amount: number;

  txid: string;
  piPaymentId: string;
};

/* =========================================================
   CREDIT SELLER
========================================================= */

export type CreditSellerInput = {
  escrowId: string;

  sellerId: string;

  amount: number;

  paymentIntentId?: string | null;
  orderId?: string | null;

  piPaymentId?: string | null;
};

/* =========================================================
   REFUND BUYER
========================================================= */

export type RefundBuyerInput = {
  escrowId: string;

  buyerId: string;

  amount: number;

  reason?: string;

  refundTxid?: string | null;

  piPaymentId?: string | null;

  approvedBy?: string | null;
};

/* =========================================================
   WITHDRAW SELLER
========================================================= */

export type WithdrawSellerInput = {
  sellerCreditId: string;

  sellerId: string;

  amount: number;

  withdrawWallet: string;

  txid?: string | null;
};

/* =========================================================
   ESCROW RELEASE JOB
========================================================= */

export type EscrowReleaseRow = {
  id: string;
  order_id: string;
  payment_intent_id: string | null;
  seller_id: string;
  amount: string;
  status: string;
  release_status: string;
  release_after: Date | null;
};

/* =========================================================
   RELEASE FLOW INPUT
========================================================= */

export type ReleaseEscrowFlowInput = {
  client: {
    query: (
      sql: string,
      params?: unknown[]
    ) => Promise<unknown>;
  };

  escrow: EscrowReleaseRow;
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

import type {
  PaymentRunSource,
} from "./common.types";

/* =========================================================
   VERIFIED MONEY CONTEXT
========================================================= */

export type VerifiedMoneyContext =
  {
    verifiedAmount: number;
    receiverWallet: string;
    piUid: string | null;
  };

/* =========================================================
   FINALIZE ORDER
========================================================= */

export type FinalizePaidOrderParams =
  {
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

export type RunPaymentSettlementInput =
  {
    paymentIntentId: string;
    piPaymentId: string;
    txid: string;

    userId?: string | null;

    source: PaymentRunSource;
  };

export type PaymentSettlementResult =
  {
    ok: boolean;

    orderId: string | null;

    amount: number;

    piCompleted: boolean;
    rpcAudited: boolean;

    source: PaymentRunSource;
  };

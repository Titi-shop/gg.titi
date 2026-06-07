import type {
  PaymentIntentStatus,
} from "./common.types";

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
  | {
      ok: true;
      lockId?: string;
    }
  | {
      ok: false;
      code: "LOCK_DENIED";
    };

import type {
  PaymentIntentRow,
  FinalizePaidOrderParams,
  FinalizePaidOrderResult,
  ShippingSnapshot,
  RpcPayload,
  PiPayload,
} from "@/lib/payments/types";

import type { PoolClient } from "pg";

/* =========================================================
   RE-EXPORT CORE TYPES
========================================================= */

export type {
  PaymentIntentRow,
  FinalizePaidOrderParams,
  FinalizePaidOrderResult,
  ShippingSnapshot,
  RpcPayload,
  PiPayload,
};

/* =========================================================
   EXISTING ORDER
========================================================= */

export type ExistingOrderRow = {
  id: string;
};

/* =========================================================
   ALREADY PAID RESULT
========================================================= */

export type AlreadyPaidResult = {
  ok: boolean;
  already: boolean;

  orderId: string | null;

  buyerId: string;
  sellerId: string;

  amount: number;
};

/* =========================================================
   RECEIPT VALIDATION
========================================================= */

export type ReceiptVerificationRow = {
  verification_status: string;
  verify_source: string;

  rpc_confirmed: boolean;

  rpc_tx_status: string;
  rpc_reason: string;
};

/* =========================================================
   SHIPPING SNAPSHOT
========================================================= */

export type PricingSnapshotItem = {
  product_id: string;
  variant_id: string | null;

  quantity: number;

  unit_price: number;
  subtotal: number;
};

export type PricingSnapshot = {
  subtotal: number;
  shipping_fee: number;
  total: number;

  items: PricingSnapshotItem[];
};

export type ParsedShippingSnapshot = {
  shipping: ShippingSnapshot;
  pricing: PricingSnapshot;
};

/* =========================================================
   STRICT PAYMENT VALIDATION
========================================================= */

export type StrictPaymentValidationInput = {
  paymentIntentId: string;

  expectedAmount: number;
  verifiedAmount: number;

  merchantWallet: string;
  receiverWallet: string;

  txid: string;

  rpcPayload: RpcPayload;
};

/* =========================================================
   FINALIZE VALIDATION
========================================================= */

export type ValidateFinalizePaymentInput = {
  client: PoolClient;

  paymentIntentId: string;

  verifiedAmount: number;
  receiverWallet: string;

  txid: string;

  rpcPayload: RpcPayload;

  intent: PaymentIntentRow;
};

export type FinalizeValidationResult = {
  shipping: ShippingSnapshot;

  pricing: {
    subtotal: number;
    shipping_fee: number;
    total: number;

    items: Array<{
      product_id: string;
      variant_id: string | null;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }>;
  };

  expectedAmount: number;
};

/* =========================================================
   FINALIZE INTENT
========================================================= */

export type FinalizeIntentInput = {
  client: PoolClient;

  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
};

/* =========================================================
   FIND EXISTING ORDER
========================================================= */

export type FindExistingOrderInput = {
  piPaymentId: string;

  buyerId: string;
  sellerId: string;

  amount: number;
};

/* =========================================================
   PAYMENT RECEIPT UPSERT
========================================================= */

export type UpsertPaymentReceiptInput = {
  client: PoolClient;

  paymentIntentId: string;

  orderId: string;
  escrowId?: string | null;
  sellerCreditId?: string | null;
  buyerId: string;

  expectedAmount: number;
  verifiedAmount: number;

  piPaymentId: string;
  txid: string;

  receiverWallet: string;

  piPayload: PiPayload;
  rpcPayload: RpcPayload;
};

/* =========================================================
   PI PAYMENTS UPSERT
========================================================= */

export type UpsertPiPaymentInput = {
  client: PoolClient;

  paymentIntentId: string;

  orderId: string;

  buyerId: string;

  piPaymentId: string;
  txid: string;

  expectedAmount: number;
  verifiedAmount: number;

  receiverWallet: string;

  country: string | null;
  zone: string | null;

  piPayload: PiPayload;
  rpcPayload: RpcPayload;
};

/* =========================================================
   FINALIZED ORDER RESULT
========================================================= */

export type FinalizedOrderResult = {
  ok: boolean;
  already: boolean;

  orderId: string | null;

  buyerId: string;
  sellerId: string;

  amount: number;
};

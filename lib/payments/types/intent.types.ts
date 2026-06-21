  import type { PricingResult } from "@/lib/payments/pricing.engine";

/* =========================================================
   SHARED BASE TYPES
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

/* =========================================================
   SHIPPING SNAPSHOT (DB SAFE - IMMUTABLE)
========================================================= */

export type ShippingSnapshot = {
  name: string | null;
  phone: string | null;
  address_line: string | null;

  ward: string | null;
  district: string | null;
  region: string | null;
  country: string | null;
  postal_code: string | null;
};

/* =========================================================
   CREATE INTENT (SERVICE INPUT)
========================================================= */

export type CreatePiPaymentIntentParams = {
  userId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  pricing: PricingResult;
};
/* =========================================================
   CREATE INTENT RESULT
========================================================= */

export type CreateIntentResult = {
  ok: boolean;

  payment_intent_id: string;

  amount: number;
  currency: "PI";

  merchant_wallet: string;

  memo: string;

  payment_state?: string;
  provider_status?: string;

  expires_at?: string | Date;

  metadata: {
    payment_intent_id: string;

    seller_id?: string;
    product_id?: string;
    variant_id?: string | null;
  };
};

/* =========================================================
   RAW INPUT PIPELINE (OPTIONAL)
========================================================= */

export type RawInput = {
  userId: string;
  raw: unknown;
};

export type CreateIntentNormalizedInput = {
  userId: string;
  addressId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
};

/* =========================================================
   SERVICE RESULT (OPTIONAL PIPELINE)
========================================================= */

export type CreateIntentServiceResult = {
  payment_intent_id: string;
  pi_payment_id: string;
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
  to_address: string;
};

/* =========================================================
   PAYMENT SUBMIT
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

export type SubmitVerifyResult =
  | {
      ok: true;
      already: boolean;
      status: string;
      paymentIntentId: string;
    }
  | {
      ok: false;
      code: string;
    };

/* =========================================================
   RPC + PI PAYLOAD (CLEANED)
========================================================= */

export type RpcPayload = {
  ok: boolean;

  amount?: number | null;
  ledger?: number | null;
  chainReference?: string | null;

  stage?: string | null;

  sender?: string | null;
  receiver?: string | null;

  reason?: string | null;

  confirmed?: boolean;
  txStatus?: string | null;

  memo?: string | null;

  createdAt?: string | null;

  payload?: unknown;
};

export type PiPayload = {
  user_uid?: string | null;
  from_address?: string | null;
  to_address?: string | null;

  amount?: number | string | null;

  identifier?: string | null;
  memo?: string | null;
  network?: string | null;

  created_at?: string | null;

  transaction?: {
    txid?: string | null;
    verified?: boolean;
  };

  status?: {
    developer_approved?: boolean;
    developer_completed?: boolean;
    transaction_verified?: boolean;
    cancelled?: boolean;
    user_cancelled?: boolean;
  };
};

/* =========================================================
   PAYMENT INTENT DB ROW (NO ANY)
========================================================= */

export type PaymentIntentRow = {
  id: string;

  buyer_id: string;
  seller_id: string;

  product_id: string;
  variant_id: string | null;

  quantity: number;

  unit_price: string;
  subtotal: string;
  discount: string;
  shipping_fee: string;
  total_amount: string;

  currency: string;

  shipping_snapshot: ShippingSnapshot | null;

  country: string;
  zone: string;

  merchant_wallet: string;

  status: string;

  payment_state: string;
  provider_status: string;

  settlement_state: string;

  expires_at: string | null;
  finalized_at: string | null;

  forensic_hash?: string | null;

  created_at?: string;
  updated_at?: string;
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

  piPayload: PiPayload;
  rpcPayload: RpcPayload;
};

export type FinalizePaidOrderResult = {
  ok: boolean;
  already: boolean;
  orderId: string | null;
  buyerId: string;
  sellerId: string;
  amount: number;
};

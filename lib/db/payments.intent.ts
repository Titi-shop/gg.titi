import crypto from "crypto";
import { query, withTransaction } from "@/lib/db";
import type {
  PricingResult,
} from "@/lib/payments/pricing.engine";

import type {
  CreatePiPaymentIntentParams,
  CreateIntentResult,
} from "@/lib/payments/types";
/* =========================================================
   GLOBAL WALLET
========================================================= */

const APP_MERCHANT_WALLET = (
  process.env.PI_MERCHANT_WALLET || ""
).trim();

/* =========================================================
   HELPERS
========================================================= */

function vlog(step: string, data?: unknown) {
  console.log(`[PAYMENT_INTENT_DB_V7][${step}]`, data ?? "");
}

function safeUUID(): string {
  return crypto.randomUUID();
}

function makeNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

function makeVerifyToken(): string {
  return crypto.randomBytes(20).toString("hex");
}

function makeInitialStatus(): PaymentIntentStatus {
  return "created";
}

function makeInitialSettlement(): SettlementState {
  return "UNSETTLED";
}

/* =========================================================
   MAIN
========================================================= */

export async function createPiPaymentIntent({
  userId,
  productId,
  variantId,
  quantity,
  country,
  zone,
  shipping,
  pricing,
}: CreatePiPaymentIntentInput): Promise<CreateIntentResult> {
  vlog("START", { userId, productId, variantId });

  if (!APP_MERCHANT_WALLET) {
    throw new Error("APP_MERCHANT_WALLET_MISSING");
  }

  return withTransaction(async (client) => {

    /* =====================================================
       1. VALIDATE PRICING (SOURCE OF TRUTH)
    ===================================================== */

    if (!pricing.items.length) {
      throw new Error("INVALID_PRICING");
    }

    const item = pricing.items[0];

    if (item.product_id !== productId) {
      throw new Error("PRICING_PRODUCT_MISMATCH");
    }

    if ((item.variant_id ?? null) !== (variantId ?? null)) {
      throw new Error("PRICING_VARIANT_MISMATCH");
    }

    vlog("PRICING_OK", {
      subtotal: pricing.subtotal,
      total: pricing.total,
    });

    /* =====================================================
       2. VERIFY OWNER (NO PRODUCT QUERY)
    ===================================================== */

    const ownerRes = await client.query<{
      seller_id: string;
    }>(
      `
      SELECT seller_id
      FROM products
      WHERE id = $1
      LIMIT 1
      `,
      [productId]
    );

    if (!ownerRes.rows.length) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    const seller_id = ownerRes.rows[0].seller_id;

    if (seller_id === userId) {
      throw new Error("SELF_PAYMENT_FORBIDDEN");
    }

    vlog("OWNER_OK", { seller_id });

    /* =====================================================
       3. IDS
    ===================================================== */

    const paymentIntentId = safeUUID();
    const nonce = makeNonce();
    const verifyToken = makeVerifyToken();
    const idempotencyKey = safeUUID();

    const memo = `ORDER-${paymentIntentId.slice(0, 8)}`;

    /* =====================================================
       4. SNAPSHOT (TRUST PRICING ENGINE)
    ===================================================== */

    const shippingSnapshot = {
  buyer_shipping: shipping,
  buyer_country: pricing.buyer_country,
  buyer_zone: pricing.buyer_zone,
  pricing_snapshot: pricing,
  product_snapshot:
    pricing.items?.[0] ?? null,
  variant_snapshot: null,
};

    /* =====================================================
       5. INSERT INTENT
    ===================================================== */

    await client.query(
      `
      INSERT INTO payment_intents (
        id,
        nonce,
        idempotency_key,
        verify_token,

        buyer_id,
        seller_id,

        product_id,
        variant_id,
        quantity,

        unit_price,
        subtotal,
        discount,
        shipping_fee,
        total_amount,

        currency,
        shipping_snapshot,

        country,
        zone,

        merchant_wallet,

        status,
        settlement_state
      )
      VALUES (
        $1,$2,$3,$4,
        $5,$6,
        $7,$8,$9,
        $10,$11,$12,$13,$14,
        'PI',
        $15,
        $16,$17,
        $18,
        $19,$20
      )
      `,
      [
        paymentIntentId,
        nonce,
        idempotencyKey,
        verifyToken,

        userId,
        seller_id,

        productId,
        variantId,
        quantity,

        item.unit_price,
        pricing.subtotal,
        0,
        pricing.shipping_fee,
        pricing.total,

        JSON.stringify(shippingSnapshot),

        pricing.buyer_country,
        pricing.buyer_zone,

        APP_MERCHANT_WALLET,

        makeInitialStatus(),
        makeInitialSettlement(),
      ]
    );

    vlog("INSERT_OK", {
      paymentIntentId,
      total: pricing.total,
    });

    return {
      ok: true,
      payment_intent_id: paymentIntentId,
      amount: pricing.total,
      currency: "PI",
      merchant_wallet: APP_MERCHANT_WALLET,
      memo,
      metadata: {
        payment_intent_id: paymentIntentId,
      },
    };
  });
}
/* =========================================================
   GET PAYMENT INTENT
========================================================= */

export async function getPaymentIntent(
  id: string
) {
  const res = await query(
    `
    SELECT *
    FROM payment_intents
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return (
    res.rows[0] ?? null
  );
}

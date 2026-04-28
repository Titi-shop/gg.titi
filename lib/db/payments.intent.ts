import { withTransaction } from "@/lib/db";

/* =========================
   TYPES
========================= */

type ShippingInput = {
  name: string;
  phone: string;
  address_line: string;
  ward?: string | null;
  district?: string | null;
  region?: string | null;
  postal_code?: string | null;
};

type CreateIntentParams = {
  userId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  country: string;
  zone: string;
  shipping: ShippingInput;
};

type CreateIntentResult = {
  paymentIntentId: string;
  amount: number;
  merchantWallet: string;
  memo: string;
  nonce: string;
};

/* =========================
   HELPERS
========================= */

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function safeQty(v: number): number {
  if (!Number.isInteger(v) || v <= 0) return 1;
  if (v > 10) return 10;
  return v;
}

function randomNonce(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 12)
  ).toUpperCase();
}

function requireMerchantWallet(): string {
  const wallet = process.env.PI_MERCHANT_WALLET;

  if (!wallet || typeof wallet !== "string" || wallet.trim().length < 20) {
    throw new Error("MERCHANT_WALLET_NOT_CONFIGURED");
  }

  return wallet.trim();
}

/* =========================
   MAIN
========================= */

export async function createPiPaymentIntent(
  params: CreateIntentParams
): Promise<CreateIntentResult> {
  if (!isUUID(params.userId)) throw new Error("INVALID_USER_ID");
  if (!isUUID(params.productId)) throw new Error("INVALID_PRODUCT_ID");

  if (params.variantId && !isUUID(params.variantId)) {
    throw new Error("INVALID_VARIANT_ID");
  }

  const quantity = safeQty(params.quantity);
  const merchantWallet = requireMerchantWallet();

  return withTransaction(async (client) => {
    console.log("🟡 [DB][PAYMENT_INTENT] START", {
      userId: params.userId,
      productId: params.productId,
    });

    /* =========================
       1. LOAD PRODUCT
    ========================= */

    const productRes = await client.query<{
      id: string;
      seller_id: string;
      name: string;
      price: string;
      sale_price: string | null;
      sale_start: string | null;
      sale_end: string | null;
      thumbnail: string | null;
      stock: number;
      is_active: boolean;
      deleted_at: string | null;
    }>(
      `
      SELECT
        id,
        seller_id,
        name,
        price,
        sale_price,
        sale_start,
        sale_end,
        thumbnail,
        stock,
        is_active,
        deleted_at
      FROM products
      WHERE id = $1
      LIMIT 1
      `,
      [params.productId]
    );

    if (!productRes.rows.length) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    const product = productRes.rows[0];

    if (!product.is_active || product.deleted_at) {
      throw new Error("PRODUCT_NOT_AVAILABLE");
    }

    if (!isUUID(product.seller_id)) {
      throw new Error("INVALID_SELLER_ID");
    }

    /* =========================
       2. RESOLVE PRICE
    ========================= */

    let unitPrice = Number(product.price);

    if (params.variantId) {
      const variantRes = await client.query<{
        id: string;
        price: string;
        sale_price: string | null;
        stock: number;
      }>(
        `
        SELECT id, price, sale_price, stock
        FROM product_variants
        WHERE id = $1
        AND product_id = $2
        LIMIT 1
        `,
        [params.variantId, params.productId]
      );

      if (!variantRes.rows.length) {
        throw new Error("INVALID_VARIANT");
      }

      const variant = variantRes.rows[0];

      if (variant.stock < quantity) {
        throw new Error("OUT_OF_STOCK");
      }

      unitPrice =
        variant.sale_price && Number(variant.sale_price) > 0
          ? Number(variant.sale_price)
          : Number(variant.price);
    } else {
      if (product.stock < quantity) {
        throw new Error("OUT_OF_STOCK");
      }

      const now = Date.now();
      const start = product.sale_start ? new Date(product.sale_start).getTime() : null;
      const end = product.sale_end ? new Date(product.sale_end).getTime() : null;

      const onSale =
        product.sale_price !== null &&
        Number(product.sale_price) > 0 &&
        start !== null &&
        end !== null &&
        now >= start &&
        now <= end;

      unitPrice = onSale
        ? Number(product.sale_price)
        : Number(product.price);
    }

    /* =========================
       3. SHIPPING VERIFY
    ========================= */

    const shippingRes = await client.query<{ price: string }>(
      `
      SELECT sr.price
      FROM shipping_rates sr
      JOIN shipping_zones sz
        ON sz.id = sr.zone_id
      WHERE sr.product_id = $1
      AND sz.code = $2
      LIMIT 1
      `,
      [params.productId, params.zone]
    );

    if (!shippingRes.rows.length) {
      throw new Error("SHIPPING_NOT_AVAILABLE");
    }

    const shippingFee = Number(shippingRes.rows[0].price);

    /* =========================
       4. TOTAL SERVER CALC
    ========================= */

    const subtotal = unitPrice * quantity;
    const discount = 0;
    const itemsTotal = subtotal - discount;
    const total = itemsTotal + shippingFee;

    if (!Number.isFinite(total) || total <= 0) {
      throw new Error("INVALID_TOTAL");
    }

    /* =========================
       5. NONCE
    ========================= */

    const nonce = randomNonce();

    /* =========================
       6. INSERT SNAPSHOT INTENT
    ========================= */

    const intentRes = await client.query<{ id: string }>(
      `
      INSERT INTO payment_intents (
        buyer_id,
        seller_id,
        product_id,
        variant_id,

        quantity,

        country,
        zone,

        shipping_name,
        shipping_phone,
        shipping_address_line,
        shipping_ward,
        shipping_district,
        shipping_region,
        shipping_postal_code,

        unit_price,
        subtotal,
        discount,
        shipping_fee,
        total,

        merchant_wallet,
        nonce,
        status
      )
      VALUES (
        $1,$2,$3,$4,
        $5,
        $6,$7,
        $8,$9,$10,$11,$12,$13,$14,
        $15,$16,$17,$18,$19,
        $20,$21,'created'
      )
      RETURNING id
      `,
      [
        params.buyer_id,
        product.seller_id,
        product.id,
        params.variantId ?? null,

        quantity,

        params.country,
        params.zone,

        params.shipping.name,
        params.shipping.phone,
        params.shipping.address_line,
        params.shipping.ward ?? null,
        params.shipping.district ?? null,
        params.shipping.region ?? null,
        params.shipping.postal_code ?? null,

        unitPrice,
        subtotal,
        discount,
        shippingFee,
        total,

        merchantWallet,
        nonce,
      ]
    );

    const paymentIntentId = intentRes.rows[0].id;

    console.log("🟢 [DB][PAYMENT_INTENT] CREATED", {
      paymentIntentId,
      total,
    });

    /* =========================
       7. RETURN CLIENT SAFE DATA
    ========================= */

    return {
      paymentIntentId,
      amount: total,
      merchantWallet,
      memo: `ORDER-${paymentIntentId.slice(0, 8)}`,
      nonce,
    };
  });
}

import { withTransaction } from "@/lib/db";

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
  memo: string;
  nonce: string;
  merchantWallet: string;
  currency: "PI";
};

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3}-[0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function safeQty(v: number): number {
  if (!Number.isInteger(v) || v <= 0) return 1;
  return Math.min(v, 100);
}

function getMerchantWallet(): string {
  const w = process.env.PI_MERCHANT_WALLET;
  if (!w) throw new Error("MISSING_MERCHANT_WALLET");
  return w.trim();
}

function generateNonce(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function createPiPaymentIntent(
  params: CreateIntentParams
): Promise<CreateIntentResult> {
  if (!isUUID(params.userId)) throw new Error("INVALID_USER_ID");
  if (!isUUID(params.productId)) throw new Error("INVALID_PRODUCT_ID");

  const variantId =
    params.variantId && isUUID(params.variantId) ? params.variantId : null;

  const quantity = safeQty(params.quantity);
  const merchantWallet = getMerchantWallet();
  const nonce = generateNonce();

  return withTransaction(async (client) => {
    /* ================= PRODUCT ================= */
    const productRes = await client.query<{
      id: string;
      seller_id: string;
      price: string;
      sale_price: string | null;
      stock: number;
    }>(
      `SELECT id, seller_id, price, sale_price, stock 
       FROM products 
       WHERE id=$1 
       FOR UPDATE`,
      [params.productId]
    );

    if (!productRes.rows.length) throw new Error("PRODUCT_NOT_FOUND");

    const product = productRes.rows[0];
    let unitPrice = Number(product.sale_price || product.price);

    /* ================= VARIANT ================= */
    if (variantId) {
      const vr = await client.query<{
        price: string;
        sale_price: string | null;
        stock: number;
      }>(
        `SELECT price, sale_price, stock 
         FROM product_variants 
         WHERE id=$1 AND product_id=$2
         FOR UPDATE`,
        [variantId, params.productId]
      );

      if (!vr.rows.length) throw new Error("INVALID_VARIANT");

      const variant = vr.rows[0];

      if (variant.stock < quantity) throw new Error("OUT_OF_STOCK");

      unitPrice = Number(variant.sale_price || variant.price);
    } else {
      if (product.stock < quantity) throw new Error("OUT_OF_STOCK");
    }

    /* ================= SHIPPING ================= */
    const ship = await client.query<{ price: string }>(
      `
      SELECT sr.price
      FROM shipping_rates sr
      JOIN shipping_zones sz ON sz.id = sr.zone_id
      WHERE sr.product_id=$1 AND sz.code=$2
      LIMIT 1
      `,
      [params.productId, params.zone]
    );

    if (!ship.rows.length) throw new Error("SHIPPING_NOT_AVAILABLE");

    const shippingFee = Number(ship.rows[0].price);

    const subtotal = unitPrice * quantity;
    const total = subtotal + shippingFee;

    /* ================= SNAPSHOT ================= */
    const shipping_snapshot = {
      ...params.shipping,
      country: params.country,
      zone: params.zone,
    };

    /* ================= INSERT INTENT ================= */
    const insert = await client.query<{ id: string }>(
      `
      INSERT INTO payment_intents (
        buyer_id,
        seller_id,
        product_id,
        variant_id,
        quantity,
        unit_price,
        subtotal,
        shipping_fee,
        total_amount,
        currency,
        shipping_snapshot,
        country,
        zone,
        merchant_wallet,
        nonce,
        status
      )
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,'PI',
        $10,$11,$12,
        $13,$14,'created'
      )
      RETURNING id
      `,
      [
        params.userId,
        product.seller_id,
        params.productId,
        variantId,
        quantity,
        unitPrice,
        subtotal,
        shippingFee,
        total,
        JSON.stringify(shipping_snapshot),
        params.country,
        params.zone,
        merchantWallet,
        nonce,
      ]
    );

    return {
      paymentIntentId: insert.rows[0].id,
      amount: total,
      memo: `ORDER-${insert.rows[0].id.slice(0, 8)}`,
      nonce,
      merchantWallet,
      currency: "PI",
    };
  });
}

import { withTransaction } from "@/lib/db";

/* ================= HELPERS ================= */

function isUUID(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f-]{36}$/i.test(v);
}

function safeQty(q: unknown): number {
  const n = Number(q);
  if (!Number.isInteger(n) || n <= 0) return 1;
  if (n > 100) return 100;
  return n;
}

/* ================= MAIN ================= */

export async function processPiPayment(params: {
  userId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  paymentId: string;
  txid: string;
  country: string;
  zone: string;

  shipping: {
    name: string;
    phone: string;
    address_line: string;
    ward?: string | null;
    district?: string | null;
    region?: string | null;
    postal_code?: string | null;
  };

  /** 🔥 NEW: amount từ Pi */
  verifiedAmount: number;
}) {

  console.log("🟡 [PAYMENT] START", {
    paymentId: params.paymentId,
    productId: params.productId,
  });

  if (!isUUID(params.productId)) {
    throw new Error("INVALID_PRODUCT_ID");
  }

  const quantity = safeQty(params.quantity);
  const zone = params.zone?.trim().toLowerCase();
  const country = params.country?.trim().toUpperCase();

  return withTransaction(async (client) => {

    /* =========================================================
       🔒 1. IDEMPOTENCY (STRONG)
    ========================================================= */

    const existingOrder = await client.query(
      `SELECT id FROM orders WHERE pi_payment_id=$1 LIMIT 1`,
      [params.paymentId]
    );

    if (existingOrder.rows.length > 0) {
      console.log("🟡 [PAYMENT] DUPLICATE ORDER");

      return {
        orderId: existingOrder.rows[0].id,
        duplicated: true,
      };
    }

    /* =========================================================
       🔒 2. INSERT PAYMENT (ANTI REPLAY)
    ========================================================= */

    await client.query(
      `
      INSERT INTO pi_payments (
  user_id,
  pi_payment_id,
  txid,
  amount,
  status,
  country,
  zone,
  verified_amount
    )
     VALUES ($1,$2,$3,$4,'verified',$5,$6,$7)
      ON CONFLICT (pi_payment_id) DO NOTHING
      `,
      [
        params.userId,
        params.paymentId,
        params.txid,
        params.verifiedAmount,
        country,
        zone,
        params.verifiedAmount,
      ]
    );

    /* =========================================================
       🌍 3. VALIDATE ZONE
    ========================================================= */

    const zoneRes = await client.query<{ code: string }>(
      `
      SELECT sz.code
      FROM shipping_zone_countries szc
      JOIN shipping_zones sz ON sz.id = szc.zone_id
      WHERE szc.country_code = $1
      LIMIT 1
      `,
      [country]
    );

    if (!zoneRes.rows.length) throw new Error("INVALID_COUNTRY");
    const realZone = zoneRes.rows[0].code;

    if (realZone !== zone) throw new Error("INVALID_REGION");
    /* =========================================================
   📍 LOAD ADDRESS (SOURCE OF TRUTH)
========================================================= */

const addressRes = await client.query(
  `
  SELECT 
    full_name,
    phone,
    address_line,
    ward,
    district,
    region,
    country,
    postal_code
  FROM addresses
  WHERE user_id = $1
  AND is_default = true
  LIMIT 1
  `,
  [params.userId]
);

if (!addressRes.rows.length) {
  throw new Error("ADDRESS_NOT_FOUND");
}

const address = addressRes.rows[0];

    /* =========================================================
       📦 4. LOAD PRODUCT
    ========================================================= */

    const productRes = await client.query(
      `
      SELECT 
        id, seller_id, name, price, thumbnail,
        is_active, deleted_at,
        sale_price, sale_start, sale_end
      FROM products
      WHERE id=$1
      LIMIT 1
      `,
      [params.productId]
    );

    const product = productRes.rows[0];

    if (!product || product.is_active === false || product.deleted_at) {
      throw new Error("PRODUCT_NOT_AVAILABLE");
    }
  if (!isUUID(product.seller_id)) {
  throw new Error("INVALID_SELLER");
}
    let price = Number(product.price);

    /* =========================================================
       🧩 5. VARIANT PRICE
    ========================================================= */

    if (params.variantId) {
      const vRes = await client.query(
        `
        SELECT price, sale_price
        FROM product_variants
        WHERE id=$1 AND product_id=$2
        LIMIT 1
        `,
        [params.variantId, params.productId]
      );

      if (!vRes.rows.length) throw new Error("INVALID_VARIANT");

      const v = vRes.rows[0];

      price =
        v.sale_price && v.sale_price > 0
          ? Number(v.sale_price)
          : Number(v.price);

      console.log("🎯 [PAYMENT] VARIANT PRICE:", price);
    } else {
      const now = Date.now();

      const start = product.sale_start
        ? new Date(product.sale_start).getTime()
        : null;

      const end = product.sale_end
        ? new Date(product.sale_end).getTime()
        : null;

      const isSale =
        product.sale_price &&
        start &&
        end &&
        now >= start &&
        now <= end;

      if (isSale) {
        price = Number(product.sale_price);
      }

      console.log("💰 [PAYMENT] PRODUCT PRICE:", price);
    }

    /* =========================================================
       🚚 6. SHIPPING
    ========================================================= */

    const shippingRes = await client.query<{ price: number }>(
      `
      SELECT sr.price
      FROM shipping_rates sr
      JOIN shipping_zones sz ON sz.id = sr.zone_id
      WHERE sr.product_id = $1
      AND sz.code = $2
      LIMIT 1
      `,
      [params.productId, realZone]
    );

    if (!shippingRes.rows.length) {
      throw new Error("SHIPPING_NOT_AVAILABLE");
    }

    const shippingFee = Number(shippingRes.rows[0].price);

    /* =========================================================
       💰 7. TOTAL (SERVER ONLY)
    ========================================================= */

    const subtotal = price * quantity;
const discount = 0; // 🔥 nếu chưa có logic giảm giá
const itemsTotal = subtotal - discount;
const total = itemsTotal + shippingFee;
    console.log("🧾 [ORDER][INSERT_DEBUG]", {
  buyer_id: params.userId,
  seller_id: product.seller_id,
  subtotal,
  shippingFee,
  total,
});

    console.log("🧾 [PAYMENT] CALC", {
      subtotal,
      shippingFee,
      total,
      verified: params.verifiedAmount,
    });

    /* =========================================================
       🔥 8. ANTI HACK (CRITICAL)
    ========================================================= */

    if (Number(params.verifiedAmount) !== Number(total)) {
      console.error("❌ [PAYMENT] AMOUNT MISMATCH", {
        server: total,
        pi: params.verifiedAmount,
      });

      throw new Error("INVALID_AMOUNT");
    }

    /* =========================================================
       📉 9. STOCK (ATOMIC)
    ========================================================= */

    if (params.variantId) {
      const stock = await client.query(
        `
        UPDATE product_variants
        SET stock = stock - $1
        WHERE id=$2 AND stock >= $1
        RETURNING id
        `,
        [quantity, params.variantId]
      );

      if (!stock.rowCount) throw new Error("OUT_OF_STOCK");
    } else {
      const stock = await client.query(
        `
        UPDATE products
        SET stock = stock - $1,
            sold = sold + $1
        WHERE id=$2 AND stock >= $1
        RETURNING id
        `,
        [quantity, params.productId]
      );

      if (!stock.rowCount) throw new Error("OUT_OF_STOCK");
    }

    /* =========================================================
       🧾 10. CREATE ORDER
    ========================================================= */

    const orderRes = await client.query(
      `
      INSERT INTO orders (
  order_number,
  buyer_id,
  seller_id,
  pi_payment_id,
  pi_txid,

  items_total,
  subtotal,
  discount,
  shipping_fee,
  tax,
  total,
  currency,

  payment_status,
  paid_at,
  status,

  shipping_name,
  shipping_phone,
  shipping_address_line,
  shipping_ward,
  shipping_district,
  shipping_region,
  shipping_country,
  shipping_postal_code,
  shipping_zone,

  total_items,
  total_quantity
)
      VALUES (
        gen_random_uuid()::text,
        $1,$2,
        $3,$4,
        $5,$6,$7,$8,$9,$10,$11,
        'paid', NOW(),
        'pending',
        $12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22
      )
      RETURNING id
      `,
     [
  params.userId,
  product.seller_id,
  params.paymentId,
  params.txid,
  itemsTotal,   // ✅ FIX
  subtotal,      // subtotal ✅
  0,             // discount
  shippingFee,
  0,             // tax
  total,
  "PI",

  address.full_name,
  address.phone,
  address.address_line,
  address.ward ?? null,
  address.district ?? null,
  address.region ?? null,
  address.country,
  address.postal_code ?? null,
  realZone,

  1,             // total_items ❗
  quantity,      // total_quantity ❗
   ]
    );

    const orderId = orderRes.rows[0].id;

    /* =========================================================
       📦 11. ORDER ITEM
    ========================================================= */

    await client.query(
      `INSERT INTO order_items (
  order_id,
  product_id,
  variant_id,
  seller_id,

  product_name,
  product_slug,
  thumbnail,

  variant_name,
  variant_value,

  unit_price,
  quantity,
  total_price,
  currency
)
VALUES (
  $1,$2,$3,$4,
  $5,$6,$7,
  $8,$9,
  $10,$11,$12,$13
)
      `,
      [
  orderId,
  product.id,
  params.variantId ?? null,
  product.seller_id,

  product.name,
  "",              // product_slug (tạm thời)
  product.thumbnail ?? "",

  "",              // variant_name
  "",              // variant_value

  price,
  quantity,
  subtotal,
  "PI",            // currency
]
    );

    /* =========================================================
       🔥 12. UPDATE PAYMENT FINAL
    ========================================================= */

    await client.query(
      `
      UPDATE pi_payments
      SET 
        status = 'completed',
        order_id = $1,
        amount = $2,
        completed_at = NOW()
      WHERE pi_payment_id = $3
      `,
      [orderId, total, params.paymentId]
    );

    console.log("🟢 [PAYMENT] SUCCESS", { orderId });

    return { orderId, duplicated: false };
  });
}

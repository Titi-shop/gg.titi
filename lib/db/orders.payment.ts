import { withTransaction } from "@/lib/db";

/* ================= HELPERS ================= */

function isUUID(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
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
  verifiedAmount: number;
}) {
  console.log("🟡 [DB] STEP 0 START", {
    paymentId: params.paymentId,
    productId: params.productId,
    amount: params.verifiedAmount,
  });

  if (!isUUID(params.productId)) {
    console.error("❌ [DB] INVALID_PRODUCT_ID");
    throw new Error("INVALID_PRODUCT_ID");
  }

  const quantity = safeQty(params.quantity);
  const zone = params.zone?.trim().toLowerCase();
  const country = params.country?.trim().toUpperCase();

  return withTransaction(async (client) => {

    /* =========================================================
       🔒 STEP 1: IDEMPOTENCY
    ========================================================= */
    console.log("🟡 [DB] STEP 1 CHECK ORDER EXIST");

    const existingOrder = await client.query(
      `SELECT id FROM orders WHERE pi_payment_id=$1 LIMIT 1`,
      [params.paymentId]
    );

    if (existingOrder.rows.length > 0) {
      console.log("🟡 [DB] DUPLICATE ORDER");
      return {
        orderId: existingOrder.rows[0].id,
        duplicated: true,
      };
    }

    /* =========================================================
       🔒 STEP 2: TXID CHECK
    ========================================================= */
    console.log("🟡 [DB] STEP 2 CHECK TXID");

    const txCheck = await client.query(
      `SELECT id FROM pi_payments WHERE txid=$1 LIMIT 1`,
      [params.txid]
    );

    if (txCheck.rows.length > 0) {
      console.error("❌ [DB] TX_ALREADY_USED");
      throw new Error("TX_ALREADY_USED");
    }

    /* =========================================================
       🔒 STEP 3: INSERT PAYMENT
    ========================================================= */
    console.log("🟡 [DB] STEP 3 INSERT PAYMENT");

    await client.query(
      `
      INSERT INTO pi_payments (
        user_id, pi_payment_id, txid,
        amount, status, country, zone, verified_amount
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
       🌍 STEP 4: VALIDATE ZONE
    ========================================================= */
    console.log("🟡 [DB] STEP 4 VALIDATE ZONE", { country, zone });

    const zoneRes = await client.query(
      `
      SELECT sz.code
      FROM shipping_zone_countries szc
      JOIN shipping_zones sz ON sz.id = szc.zone_id
      WHERE szc.country_code = $1
      LIMIT 1
      `,
      [country]
    );

    if (!zoneRes.rows.length) {
      console.error("❌ [DB] INVALID_COUNTRY");
      throw new Error("INVALID_COUNTRY");
    }

    const realZone = zoneRes.rows[0].code;

    if (realZone !== zone) {
      console.error("❌ [DB] INVALID_REGION", { realZone, zone });
      throw new Error("INVALID_REGION");
    }

    /* =========================================================
       📍 STEP 5: LOAD ADDRESS
    ========================================================= */
    console.log("🟡 [DB] STEP 5 LOAD ADDRESS");

    const addressRes = await client.query(
      `
      SELECT *
      FROM addresses
      WHERE user_id = $1 AND is_default = true
      LIMIT 1
      `,
      [params.userId]
    );

    if (!addressRes.rows.length) {
      console.error("❌ [DB] ADDRESS_NOT_FOUND");
      throw new Error("ADDRESS_NOT_FOUND");
    }

    const address = addressRes.rows[0];

    /* =========================================================
       📦 STEP 6: LOAD PRODUCT
    ========================================================= */
    console.log("🟡 [DB] STEP 6 LOAD PRODUCT");

    const productRes = await client.query(
      `
      SELECT *
      FROM products
      WHERE id=$1
      FOR UPDATE
      `,
      [params.productId]
    );

    const product = productRes.rows[0];

    if (!product || product.is_active === false || product.deleted_at) {
      console.error("❌ [DB] PRODUCT_NOT_AVAILABLE");
      throw new Error("PRODUCT_NOT_AVAILABLE");
    }

    let price = Number(product.price);

    /* =========================================================
       🧩 STEP 7: VARIANT
    ========================================================= */
    if (params.variantId) {
      console.log("🟡 [DB] STEP 7 VARIANT");

      const vRes = await client.query(
        `
        SELECT price, sale_price
        FROM product_variants
        WHERE id=$1 AND product_id=$2
        FOR UPDATE
        `,
        [params.variantId, params.productId]
      );

      if (!vRes.rows.length) {
        console.error("❌ [DB] INVALID_VARIANT");
        throw new Error("INVALID_VARIANT");
      }

      const v = vRes.rows[0];

      price = v.sale_price > 0 ? Number(v.sale_price) : Number(v.price);
    }

    /* =========================================================
       🚚 STEP 8: SHIPPING
    ========================================================= */
    console.log("🟡 [DB] STEP 8 SHIPPING");

    const shippingRes = await client.query(
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
      console.error("❌ [DB] SHIPPING_NOT_AVAILABLE");
      throw new Error("SHIPPING_NOT_AVAILABLE");
    }

    const shippingFee = Number(shippingRes.rows[0].price);

    /* =========================================================
       💰 STEP 9: CALC
    ========================================================= */
    const subtotal = price * quantity;
    const total = subtotal + shippingFee;

    console.log("🧾 [DB] STEP 9 CALC", {
      subtotal,
      shippingFee,
      total,
      verified: params.verifiedAmount,
    });

    if (Number(params.verifiedAmount) !== Number(total)) {
      console.error("❌ [DB] AMOUNT_MISMATCH");
      throw new Error("INVALID_AMOUNT");
    }

    /* =========================================================
       📉 STEP 10: STOCK
    ========================================================= */
    console.log("🟡 [DB] STEP 10 STOCK");

    const stock = await client.query(
      `
      UPDATE products
      SET stock = stock - $1
      WHERE id=$2 AND stock >= $1
      RETURNING id
      `,
      [quantity, params.productId]
    );

    if (!stock.rowCount) {
      console.error("❌ [DB] OUT_OF_STOCK");
      throw new Error("OUT_OF_STOCK");
    }

    /* =========================================================
       🧾 STEP 11: CREATE ORDER
    ========================================================= */
    console.log("🟡 [DB] STEP 11 CREATE ORDER");

    const orderRes = await client.query(
      `
      INSERT INTO orders (
        order_number,
        buyer_id,
        seller_id,
        pi_payment_id,
        pi_txid,
        subtotal,
        shipping_fee,
        total,
        currency,
        payment_status,
        paid_at,
        status,
        shipping_name,
        shipping_phone,
        shipping_address_line,
        shipping_country
      )
      VALUES (
        gen_random_uuid()::text,
        $1,$2,$3,$4,
        $5,$6,$7,'PI',
        'paid', NOW(),'pending',
        $8,$9,$10,$11
      )
      RETURNING id
      `,
      [
        params.userId,
        product.seller_id,
        params.paymentId,
        params.txid,
        subtotal,
        shippingFee,
        total,
        address.full_name,
        address.phone,
        address.address_line,
        address.country,
      ]
    );

    const orderId = orderRes.rows[0].id;

    /* =========================================================
       🔥 STEP 12: FINAL
    ========================================================= */
    console.log("🟢 [DB] SUCCESS", { orderId });

    return { orderId, duplicated: false };
  });
}

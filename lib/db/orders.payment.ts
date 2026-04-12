// lib/db/orders.payment.ts

import { withTransaction } from "@/lib/db";

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
}) {
  function isUUID(v: string): boolean {
    return /^[0-9a-f-]{36}$/i.test(v);
  }

  const zone = params.zone?.trim().toLowerCase();
  const country = params.country?.trim().toUpperCase();

  if (!isUUID(params.productId)) {
    throw new Error("INVALID_PRODUCT_ID");
  }

  return withTransaction(async (client) => {

    /* ================= IDEMPOTENCY ================= */
    const existing = await client.query(
      `SELECT id FROM orders WHERE pi_payment_id=$1 LIMIT 1`,
      [params.paymentId]
    );

    if (existing.rows.length > 0) {
      return { orderId: existing.rows[0].id, duplicated: true };
    }

    /* ================= ZONE ================= */
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

    if (!zoneRes.rows.length) {
      throw new Error("INVALID_COUNTRY");
    }

    const realZone = zoneRes.rows[0].code;

    if (realZone !== zone) {
      throw new Error("INVALID_REGION");
    }

    /* ================= PRODUCT ================= */
    const productRes = await client.query(
      `
      SELECT id, seller_id, name, price, thumbnail, is_active, deleted_at
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

    const price = Number(product.price);

    /* ================= SHIPPING ================= */
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

    /* ================= STOCK ================= */
    if (params.variantId) {
      const stockUpdate = await client.query(
        `
        UPDATE product_variants
        SET stock = stock - $1
        WHERE id = $2 AND stock >= $1
        RETURNING id
        `,
        [params.quantity, params.variantId]
      );

      if (!stockUpdate.rowCount) throw new Error("OUT_OF_STOCK");
    } else {
      const stock = await client.query(
        `
        UPDATE products
        SET stock = stock - $1,
            sold = sold + $1
        WHERE id = $2 AND stock >= $1
        RETURNING id
        `,
        [params.quantity, params.productId]
      );

      if (!stock.rowCount) throw new Error("OUT_OF_STOCK");
    }

    /* ================= TOTAL ================= */
    const subtotal = price * params.quantity;
    const total = subtotal + shippingFee;

    console.log("🟣 [ORDER] FINAL_PAYLOAD", {
      buyer: params.userId,
      seller: product.seller_id,
      shipping: params.shipping,
      zone: realZone,
      total,
    });

    /* ================= ORDER ================= */
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

        $12,$13,

        $14,

        $15,$16,$17,$18,$19,$20,$21,$22,$23,

        $24,$25
      )
      RETURNING id
      `,
      [
        params.userId,
        product.seller_id,

        params.paymentId,
        params.txid,

        subtotal,
        subtotal,
        0,
        shippingFee,
        0,
        total,
        "PI",

        "paid",
        new Date(),

        "pending",

        params.shipping.name,
        params.shipping.phone,
        params.shipping.address_line,
        params.shipping.ward ?? null,
        params.shipping.district ?? null,
        params.shipping.region ?? null,
        params.country,
        params.shipping.postal_code ?? null,
        realZone,

        1,
        params.quantity
      ]
    );

    const orderId = orderRes.rows[0].id;

    /* ================= ITEM ================= */
    await client.query(
      `
      INSERT INTO order_items (
        order_id,
        product_id,
        variant_id,
        seller_id,
        product_name,
        thumbnail,
        unit_price,
        quantity,
        total_price
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
      [
        orderId,
        product.id,
        params.variantId ?? null,
        product.seller_id,
        product.name,
        product.thumbnail ?? "",
        price,
        params.quantity,
        subtotal,
      ]
    );

    return { orderId, duplicated: false };
  });
}

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

  if (!isUUID(params.productId)) {
    throw new Error("INVALID_PRODUCT_ID");
  }

  const zone = params.zone?.trim().toLowerCase();
  const country = params.country?.trim().toUpperCase();

  return withTransaction(async (client) => {

    /* =========================================================
       🔒 1. IDEMPOTENCY (STRONG - USING pi_payments)
    ========================================================= */

    const paymentRes = await client.query(
      `
      SELECT id, status
      FROM pi_payments
      WHERE pi_payment_id = $1
      FOR UPDATE
      `,
      [params.paymentId]
    );

    if (paymentRes.rows.length > 0) {
      const payment = paymentRes.rows[0];

      if (payment.status === "completed") {
        const existing = await client.query(
          `SELECT id FROM orders WHERE pi_payment_id = $1 LIMIT 1`,
          [params.paymentId]
        );

        return {
          orderId: existing.rows[0]?.id ?? null,
          duplicated: true,
        };
      }

      // nếu pending → tiếp tục (retry case)
    } else {
      // insert payment trước (anti replay)
      await client.query(
        `
        INSERT INTO pi_payments (
          user_id,
          pi_payment_id,
          txid,
          amount,
          status,
          country,
          zone
        )
        VALUES ($1,$2,$3,$4,'pending',$5,$6)
        `,
        [
          params.userId,
          params.paymentId,
          params.txid,
          0, // sẽ update sau
          country,
          zone,
        ]
      );
    }

    /* =========================================================
       🌍 2. VALIDATE ZONE
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

    if (!zoneRes.rows.length) {
      throw new Error("INVALID_COUNTRY");
    }

    const realZone = zoneRes.rows[0].code;

    if (realZone !== zone) {
      throw new Error("INVALID_REGION");
    }

    /* =========================================================
       📦 3. LOAD PRODUCT (SOURCE OF TRUTH)
    ========================================================= */

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

    let price = Number(product.price);

    /* =========================================================
       🧩 4. VARIANT PRICE (ANTI FAKE PRICE)
    ========================================================= */

    if (params.variantId) {
      const vRes = await client.query(
        `
        SELECT price, sale_price
        FROM product_variants
        WHERE id = $1 AND product_id = $2
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
    }

    /* =========================================================
       🚚 5. SHIPPING
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
       📉 6. STOCK (ATOMIC)
    ========================================================= */

    if (params.variantId) {
      const stock = await client.query(
        `
        UPDATE product_variants
        SET stock = stock - $1
        WHERE id = $2 AND stock >= $1
        RETURNING id
        `,
        [params.quantity, params.variantId]
      );

      if (!stock.rowCount) throw new Error("OUT_OF_STOCK");
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

    /* =========================================================
       💰 7. TOTAL (SERVER ONLY)
    ========================================================= */

    const subtotal = price * params.quantity;
    const total = subtotal + shippingFee;

    /* =========================================================
       🧾 8. CREATE ORDER
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

        1,$21
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

        params.shipping.name,
        params.shipping.phone,
        params.shipping.address_line,
        params.shipping.ward ?? null,
        params.shipping.district ?? null,
        params.shipping.region ?? null,
        country,
        params.shipping.postal_code ?? null,
        realZone,

        params.quantity
      ]
    );

    const orderId = orderRes.rows[0].id;

    /* =========================================================
       📦 9. ORDER ITEM
    ========================================================= */

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

    /* =========================================================
       🔥 10. UPDATE PAYMENT (FINAL)
    ========================================================= */

    await client.query(
      `
      UPDATE pi_payments
      SET status = 'completed',
          order_id = $1,
          amount = $2,
          completed_at = NOW()
      WHERE pi_payment_id = $3
      `,
      [orderId, total, params.paymentId]
    );

    return { orderId, duplicated: false };
  });
}

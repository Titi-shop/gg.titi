import { withTransaction } from "@/lib/db";
type OrderItemInternal = {
  product: {
    id: string;
    seller_id: string;
    name: string;
    thumbnail: string | null;
  };
  variant_id: string | null;
  price: number;
  qty: number;
  total: number;
};
type CreateOrderInput = {
  userId: string;
  items: {
    product_id: string;
    quantity: number;
    variant_id?: string | null;
  }[];

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
};

function isUUID(v: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(v);
}

export async function createOrder(input: CreateOrderInput) {
  const { userId, items } = input;

  if (!userId) throw new Error("INVALID_USER");
  if (!Array.isArray(items) || items.length === 0)
    throw new Error("INVALID_ITEMS");

  const zone = input.zone?.trim().toLowerCase();
  const country = input.country?.trim().toUpperCase();

  return withTransaction(async (client) => {

    console.log("🟡 [ORDER][CREATE] START", {
      userId,
      itemsCount: items.length,
    });

    /* ================= VALIDATE ZONE ================= */

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

    /* ================= LOAD PRODUCTS ================= */

    const productIds = items.map((i) => i.product_id);

    const { rows: products } = await client.query<{
      id: string;
      seller_id: string;
      name: string;
      price: number;
      sale_price: number | null;
      sale_start: string | null;
      sale_end: string | null;
      thumbnail: string;
      is_active: boolean;
      deleted_at: string | null;
    }>(
      `
      SELECT id, seller_id, name, price,
             sale_price, sale_start, sale_end,
             thumbnail, is_active, deleted_at
      FROM products
      WHERE id = ANY($1::uuid[])
      `,
      [productIds]
    );

    const productMap = new Map(products.map((p) => [p.id, p]));

    /* ================= LOAD VARIANTS ================= */

    const variantIds = items
      .map((i) => i.variant_id)
      .filter(Boolean);

    const { rows: variants } =
      variantIds.length > 0
        ? await client.query<{
            id: string;
            product_id: string;
            price: number;
            sale_price: number | null;
          }>(
            `
            SELECT id, product_id, price, sale_price
            FROM product_variants
            WHERE id = ANY($1::uuid[])
            `,
            [variantIds]
          )
        : { rows: [] };

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    /* ================= CALCULATE ================= */

    let subtotal = 0;
    let totalQuantity = 0;
    const orderItems: OrderItemInternal[] = [];

    for (const item of items) {
      if (!isUUID(item.product_id)) {
        throw new Error("INVALID_PRODUCT_ID");
      }

      const p = productMap.get(item.product_id);
      if (!p) throw new Error("INVALID_PRODUCT");

      if (p.is_active === false || p.deleted_at) {
        throw new Error("PRODUCT_NOT_AVAILABLE");
      }

      const qty = item.quantity > 0 ? item.quantity : 1;

      let price = Number(p.price);

      /* ===== VARIANT ===== */
      if (item.variant_id) {
        const v = variantMap.get(item.variant_id);
        if (!v) throw new Error("INVALID_VARIANT");

        price =
          v.sale_price && v.sale_price > 0
            ? Number(v.sale_price)
            : Number(v.price);
      } else {
        /* ===== SALE ===== */
        const now = Date.now();

        const start = p.sale_start
          ? new Date(p.sale_start).getTime()
          : null;

        const end = p.sale_end
          ? new Date(p.sale_end).getTime()
          : null;

        const isSale =
          p.sale_price &&
          start &&
          end &&
          now >= start &&
          now <= end;

        price = isSale
          ? Number(p.sale_price)
          : Number(p.price);
      }

      const total = price * qty;

      subtotal += total;
      totalQuantity += qty;

      orderItems.push({
  product: {
    id: p.id,
    seller_id: p.seller_id,
    name: p.name,
    thumbnail: p.thumbnail ?? null,
  },
  variant_id: item.variant_id ?? null,
  price,
  qty,
  total,
});
    }

    /* ================= SHIPPING ================= */

    const { rows: shippingRows } = await client.query<{
      product_id: string;
      price: number;
    }>(
      `
      SELECT sr.product_id, sr.price
      FROM shipping_rates sr
      JOIN shipping_zones sz ON sz.id = sr.zone_id
      WHERE sr.product_id = ANY($1::uuid[])
      AND sz.code = $2
      `,
      [productIds, realZone]
    );

    const shippingMap = new Map(
      shippingRows.map((r) => [r.product_id, Number(r.price)])
    );

    let shippingFee = 0;

    for (const item of items) {
      const fee = shippingMap.get(item.product_id);
      if (fee === undefined) throw new Error("SHIPPING_NOT_AVAILABLE");
      shippingFee += fee;
    }

    const total = subtotal + shippingFee;

    console.log("💰 [ORDER][TOTAL]", {
      subtotal,
      shippingFee,
      total,
    });

    /* ================= STOCK ================= */

    for (const item of orderItems) {
  if (item.variant_id) {
    const res = await client.query(
      `
      UPDATE product_variants
      SET stock = stock - $1
      WHERE id = $2 AND stock >= $1
      `,
      [item.qty, item.variant_id]
    );

    if (!res.rowCount) throw new Error("OUT_OF_STOCK");
  } else {
    const res = await client.query(
      `
      UPDATE products
      SET stock = stock - $1,
          sold = sold + $1
      WHERE id = $2 AND stock >= $1
      `,
      [item.qty, item.product.id]
    );

    if (!res.rowCount) throw new Error("OUT_OF_STOCK");
  }
}

    /* ================= CREATE ORDER ================= */

    const orderRes = await client.query(
      `
      INSERT INTO orders (
        order_number,
        buyer_id,
        seller_id,

        subtotal,
        shipping_fee,
        total,

        payment_status,
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
        $3,$4,$5,
        'pending',
        'pending',
        $6,$7,$8,$9,$10,$11,$12,$13,$14,
        $15,$16
      )
      RETURNING id
      `,
      [
        userId,
        orderItems[0].product.seller_id,

        subtotal,
        shippingFee,
        total,

        input.shipping.name,
        input.shipping.phone,
        input.shipping.address_line,
        input.shipping.ward ?? null,
        input.shipping.district ?? null,
        input.shipping.region ?? null,
        country,
        input.shipping.postal_code ?? null,
        realZone,

        orderItems.length,
        totalQuantity,
      ]
    );

    const orderId = orderRes.rows[0].id;

    /* ================= ORDER ITEMS ================= */

    for (const item of orderItems) {
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
    item.product.id,
    item.variant_id,
    item.product.seller_id,
    item.product.name,
    item.product.thumbnail ?? "",
    item.price,
    item.qty,
    item.total,
  ]
   );
    }

    console.log("🟢 [ORDER][CREATED]", { orderId });

    return { orderId };
  });
}

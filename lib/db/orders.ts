
import { query } from "@/lib/db";
import { PoolClient } from "pg";


function isUUID(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/* =========================================================
   SELLER — ORDER COUNTS
========================================================= */

export async function getSellerOrderCounts(sellerId: string) {
  const { rows } = await query(
    `
    SELECT status, COUNT(*)::int AS total
    FROM order_items
    WHERE seller_id = $1
    GROUP BY status
    `,
    [sellerId]
  );

  const result = {
    pending: 0,
    confirmed: 0,
    shipping: 0,
    completed: 0,
    returned: 0,
    cancelled: 0,
  };

  for (const r of rows) {
    if (r.status in result) {
      result[r.status as keyof typeof result] = r.total;
    }
  }

  return result;
}

/* =========================================================
   SELLER — ORDERS LIST
========================================================= */

export async function getSellerOrders(
  sellerId: string,
  status?: string,
  page = 1,
  limit = 20
) {
  const offset = (page - 1) * limit;

  const params: unknown[] = [sellerId, limit, offset];
  let statusFilter = "";

  if (status) {
    params.splice(1, 0, status);
    statusFilter = `AND oi.status = $2`;
  }

  const { rows } = await query(
    `
    SELECT
      o.id,
      o.order_number,
      o.created_at,

      o.shipping_name,
      o.shipping_phone,
      o.shipping_address,

      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'thumbnail', oi.thumbnail,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price,
            'status', oi.status
          )
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'
      ) AS order_items,

      SUM(oi.total_price)::float AS total

    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id

    WHERE oi.seller_id = $1
    ${statusFilter}

    GROUP BY o.id
    ORDER BY o.created_at DESC

    LIMIT $${status ? 3 : 2}
    OFFSET $${status ? 4 : 3}
    `,
    params
  );

  return rows;
}

/* =========================================================
   SELLER — ORDER DETAIL
========================================================= */

export async function getSellerOrderById(
  orderId: string,
  sellerId: string
) {
  const { rows } = await query(
    `
    SELECT
      o.id,
      o.order_number,
      o.created_at,

      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'thumbnail', oi.thumbnail,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price,
            'status', oi.status
          )
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'
      ) AS order_items,

      SUM(oi.total_price)::float AS total

    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id

    WHERE o.id = $1 AND oi.seller_id = $2

    GROUP BY o.id
    `,
    [orderId, sellerId]
  );

  return rows[0] ?? null;
}

/* =========================================================
   SELLER — ACTIONS
========================================================= */

export async function startShippingBySeller(
  orderId: string,
  sellerId: string
) {
  const res = await query(
    `
    UPDATE order_items
    SET status='shipping', shipped_at=NOW()
    WHERE order_id=$1 AND seller_id=$2 AND status='confirmed'
    `,
    [orderId, sellerId]
  );

  return res.rowCount > 0;
}

export async function cancelOrderBySeller(
  orderId: string,
  sellerId: string,
  reason: string | null
) {
  const res = await query(
    `
    UPDATE order_items
    SET status='cancelled', seller_cancel_reason=$3
    WHERE order_id=$1 AND seller_id=$2
    `,
    [orderId, sellerId, reason]
  );

  return res.rowCount > 0;
}

export async function confirmOrderBySeller(
  orderId: string,
  sellerId: string,
  message: string | null
) {
  return withTransaction(async (client) => {
    await client.query(
      `
      UPDATE order_items
      SET status='confirmed', seller_message=$3
      WHERE order_id=$1 AND seller_id=$2
      `,
      [orderId, sellerId, message]
    );

    await client.query(
      `UPDATE orders SET status='pickup' WHERE id=$1`,
      [orderId]
    );

    return true;
  });
}

/* =========================================================
   BUYER — ORDERS
========================================================= */

export async function getOrdersByBuyer(userId: string) {
  const { rows } = await query(
    `
    SELECT
      o.id,
      o.order_number,
      o.status,
      o.total,
      o.created_at,

      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'thumbnail', oi.thumbnail,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price,
            'status', oi.status
          )
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'
      ) AS order_items

    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id

    WHERE o.buyer_id = $1
    GROUP BY o.id
    ORDER BY o.created_at DESC
    `,
    [userId]
  );

  return rows;
}

export async function getBuyerOrderCounts(userId: string) {
  const { rows } = await query(
    `
    SELECT
      COUNT(*) FILTER (WHERE status='pending')::int AS pending,
      COUNT(*) FILTER (WHERE status='pickup')::int AS pickup,
      COUNT(*) FILTER (WHERE status='shipping')::int AS shipping,
      COUNT(*) FILTER (WHERE status='completed')::int AS completed,
      COUNT(*) FILTER (WHERE status='cancelled')::int AS cancelled
    FROM orders
    WHERE buyer_id=$1
    `,
    [userId]
  );

  return rows[0];
}

export async function getOrderByBuyerId(
  orderId: string,
  userId: string
) {
  const { rows } = await query(
    `
    SELECT
      o.id,
      o.status,
      o.total,
      o.created_at,

      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'thumbnail', oi.thumbnail,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price,
            'status', oi.status
          )
        ),
        '[]'
      ) AS order_items

    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id

    WHERE o.id=$1 AND o.buyer_id=$2
    GROUP BY o.id
    `,
    [orderId, userId]
  );

  return rows[0] ?? null;
}

/* =========================================================
   CART
========================================================= */

export async function getCartByBuyer(userId: string) {
  const { rows } = await query(
    `
    SELECT 
      c.product_id,
      c.variant_id,
      c.quantity,

      p.name,
      p.price,
      p.sale_price,
      p.thumbnail,
      p.images

    FROM cart_items c
    JOIN products p ON p.id = c.product_id

    WHERE c.buyer_id = $1
    ORDER BY c.created_at DESC
    `,
    [userId]
  );

  return rows;
}

export async function deleteCartItem(
  userId: string,
  productId: string,
  variantId?: string | null
) {
  await query(
    `
    DELETE FROM cart_items
    WHERE buyer_id=$1
    AND product_id=$2
    AND variant_id IS NOT DISTINCT FROM $3
    `,
    [userId, productId, variantId ?? null]
  );
}

/* =========================================================
   RETURNS
========================================================= */

export async function getReturnsByBuyer(userId: string) {
  const { rows } = await query(
    `
    SELECT *
    FROM returns
    WHERE buyer_id = $1
    ORDER BY created_at DESC
    `,
    [userId]
  );

  return rows;
}
export async function processPiPayment(params: {
  userId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  paymentId: string;
  txid: string;
  country: string;
  zone: string;
}) {
  function isUUID(v: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  }

  if (!isUUID(params.productId)) {
    console.error("❌ [ORDER] INVALID_PRODUCT_ID", params.productId);
    throw new Error("INVALID_PRODUCT_ID");
  }

  return withTransaction(async (client) => {

    console.log("🟡 [ORDER][START]", {
      productId: params.productId,
      variantId: params.variantId,
      quantity: params.quantity,
      paymentId: params.paymentId,
    });

    /* ================= IDEMPOTENCY ================= */
    const existing = await client.query(
      `SELECT id FROM orders WHERE pi_payment_id=$1 LIMIT 1`,
      [params.paymentId]
    );

    if (existing.rows.length > 0) {
      console.log("🟡 [ORDER] DUPLICATED PAYMENT", params.paymentId);
      return { orderId: existing.rows[0].id, duplicated: true };
    }

    /* ================= GET ZONE ================= */
    const zoneRes = await client.query<{ code: string }>(
      `
      SELECT sz.code
      FROM shipping_zone_countries szc
      JOIN shipping_zones sz ON sz.id = szc.zone_id
      WHERE szc.country_code = $1
      LIMIT 1
      `,
      [params.country.toUpperCase()]
    );

    console.log("🟡 [ORDER] ZONE_RESULT", zoneRes.rows);

    if (!zoneRes.rows.length) {
      console.error("❌ [ORDER] INVALID_COUNTRY", params.country);
      throw new Error("INVALID_COUNTRY");
    }

    const realZone = zoneRes.rows[0].code;

    console.log("🟡 [ORDER] ZONE_CHECK", {
      realZone,
      zone: params.zone,
    });

    if (realZone !== params.zone) {
      console.error("❌ [ORDER] INVALID_REGION", {
        realZone,
        zone: params.zone,
      });
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

    console.log("🟡 [ORDER] PRODUCT", product);

    if (!product || product.is_active === false || product.deleted_at) {
      console.error("❌ [ORDER] PRODUCT_NOT_AVAILABLE");
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
      [product.seller_id, realZone]
    );

    console.log("🟡 [ORDER] SHIPPING_RESULT", shippingRes.rows);

    if (!shippingRes.rows.length) {
      console.error("❌ [ORDER] SHIPPING_NOT_AVAILABLE", {
        seller_id: product.seller_id,
        zone: realZone,
      });
      throw new Error("SHIPPING_NOT_AVAILABLE");
    }

    const shippingFee = Number(shippingRes.rows[0].price);

    console.log("🟡 [ORDER] SHIPPING_FEE", shippingFee);

    /* ================= ADDRESS ================= */
    const addrRes = await client.query(
      `
      SELECT full_name, phone, address_line
      FROM addresses
      WHERE user_id=$1 AND is_default=true
      LIMIT 1
      `,
      [params.userId]
    );

    const addr = addrRes.rows[0];

    console.log("🟡 [ORDER] ADDRESS", addr);

    if (!addr) {
      console.error("❌ [ORDER] NO_ADDRESS");
      throw new Error("NO_ADDRESS");
    }

    /* ===== VARIANT ===== */

    if (params.variantId) {
      console.log("🟡 [ORDER] VARIANT_FLOW");

      const variantRes = await client.query(
        `
        SELECT id, stock
        FROM product_variants
        WHERE id = $1 AND product_id = $2
        LIMIT 1
        `,
        [params.variantId, params.productId]
      );

      const variant = variantRes.rows[0];

      console.log("🟡 [ORDER] VARIANT", variant);

      if (!variant) {
        console.error("❌ [ORDER] VARIANT_NOT_FOUND");
        throw new Error("VARIANT_NOT_FOUND");
      }

      const stockUpdate = await client.query(
        `
        UPDATE product_variants
        SET stock = stock - $1
        WHERE id = $2
        AND stock >= $1
        RETURNING id
        `,
        [params.quantity, params.variantId]
      );

      console.log("🟡 [ORDER] VARIANT_STOCK_UPDATE", stockUpdate.rowCount);

      if (!stockUpdate.rowCount) {
        console.error("❌ [ORDER] OUT_OF_STOCK_VARIANT");
        throw new Error("OUT_OF_STOCK");
      }

    } else {
      console.log("🟡 [ORDER] PRODUCT_FLOW");

      const stock = await client.query(
        `
        UPDATE products
        SET stock = stock - $1,
            sold = sold + $1
        WHERE id = $2
        AND stock >= $1
        RETURNING id
        `,
        [params.quantity, params.productId]
      );

      console.log("🟡 [ORDER] PRODUCT_STOCK_UPDATE", stock.rowCount);

      if (!stock.rowCount) {
        console.error("❌ [ORDER] OUT_OF_STOCK_PRODUCT");
        throw new Error("OUT_OF_STOCK");
      }
    }

    /* ================= TOTAL ================= */
    const subtotal = price * params.quantity;
    const total = subtotal + shippingFee;

    console.log("🟡 [ORDER] TOTAL", {
      subtotal,
      shippingFee,
      total,
    });
    /* ================= ORDER ================= */

const orderRes = await client.query(
  `
  INSERT INTO orders (
    order_number,
    buyer_id,
    pi_payment_id,
    pi_txid,

    total,
    subtotal,
    items_total,
    discount,
    tax,

    currency,
    payment_status,
    paid_at,

    shipping_name,
    shipping_phone,
    shipping_address,
    shipping_zone,
    shipping_fee,
    shipping_country,
    shipping_postal_code,
    shipping_province
  )
  VALUES (
    gen_random_uuid()::text,
    $1,$2,$3,

    $4,$5,$6,$7,$8,

    $9,$10,$11,

    $12,$13,$14,$15,$16,$17,$18,$19
  )
  RETURNING id
  `,
  [
    params.userId,
    params.paymentId,
    params.txid,

    total,                 // total
    subtotal,              // subtotal
    subtotal,              // items_total
    0,                     // discount
    0,                     // tax

    "PI",                  // currency
    "paid",                // payment_status
    NOW(),            // paid_at

    addr.full_name,
    addr.phone,
    addr.address_line,
    realZone,
    shippingFee,
    params.country ?? "VN", // shipping_country
    null,                   // postal_code (nếu chưa có)
    null,                   // province (nếu chưa có)
  ]
);

    const orderId = orderRes.rows[0].id;

    console.log("🟡 [ORDER] ORDER_CREATED", orderId);

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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
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

    console.log("🟢 [ORDER] SUCCESS", { orderId });

    return { orderId, duplicated: false };
  });
}
export async function upsertCartItems(
  userId: string,
  items: {
    product_id: string;
    variant_id?: string | null;
    quantity?: number;
  }[]
): Promise<void> {
  if (!userId) {
    throw new Error("INVALID_USER_ID");
  }

  if (!Array.isArray(items) || items.length === 0) {
    return;
  }

  const productIds: string[] = [];
  const variantIds: (string | null)[] = [];
  const quantities: number[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;

    // ✅ validate product_id
    if (!isUUID(item.product_id)) {
      console.error("[CART] INVALID product_id:", item.product_id);
      continue;
    }

    // ✅ quantity safe
    const qty =
      typeof item.quantity === "number" &&
      !Number.isNaN(item.quantity) &&
      item.quantity > 0
        ? Math.min(item.quantity, 99)
        : 1;

    productIds.push(item.product_id);

    // ✅ FIX variant_id
    variantIds.push(
      isUUID(item.variant_id) ? item.variant_id : null
    );

    quantities.push(qty);
  }

  if (productIds.length === 0) return;

  await query(
  `
  INSERT INTO cart_items (buyer_id, product_id, variant_id, quantity)
  SELECT 
    $1,
    x.product_id,
    x.variant_id,
    x.quantity
  FROM UNNEST($2::uuid[], $3::uuid[], $4::int[]) 
    AS x(product_id, variant_id, quantity)

  ON CONFLICT (
    buyer_id,
    product_id,
    COALESCE(variant_id, '00000000-0000-0000-0000-000000000000')
  )
  DO UPDATE SET
    quantity = cart_items.quantity + EXCLUDED.quantity,
    updated_at = NOW()
  `,
  [userId, productIds, variantIds, quantities]
);
}

export async function cancelOrderByBuyer(
  orderId: string,
  userId: string,
  reason: string
): Promise<"OK" | "NOT_FOUND" | "FORBIDDEN" | "INVALID_STATUS"> {
  if (!orderId || !userId) {
    throw new Error("INVALID_INPUT");
  }

  try {
    return await withTransaction(async (client) => {
      /* 1️⃣ CHECK ORDER */
      const { rows } = await client.query<{
        buyer_id: string;
        status: string;
      }>(
        `
        SELECT buyer_id, status
        FROM orders
        WHERE id = $1
        LIMIT 1
        `,
        [orderId]
      );

      const order = rows[0];

      if (!order) return "NOT_FOUND";
      if (order.buyer_id !== userId) return "FORBIDDEN";
      if (order.status !== "pending") return "INVALID_STATUS";

      /* 2️⃣ UPDATE ITEMS */
      await client.query(
        `
        UPDATE order_items
        SET
          status = 'cancelled',
          seller_cancel_reason = $2
        WHERE order_id = $1
        AND status = 'pending'
        `,
        [orderId, reason ?? null]
      );

      /* 3️⃣ UPDATE ORDER */
      await client.query(
        `
        UPDATE orders
        SET
          status = 'cancelled',
          cancel_reason = $2,
          cancelled_at = NOW()
        WHERE id = $1
        `,
        [orderId, reason ?? null]
      );

      return "OK";
    });
  } catch {
    throw new Error("FAILED_TO_CANCEL_ORDER");
  }
}

export async function completeOrderByBuyer(
  orderId: string,
  userId: string
): Promise<boolean> {
  if (!orderId || !userId) {
    throw new Error("INVALID_INPUT");
  }

  try {
    return await withTransaction(async (client) => {
      /* 1️⃣ CHECK ORDER */
      const { rows } = await client.query<{ status: string }>(
        `
        SELECT status
        FROM orders
        WHERE id = $1
        AND buyer_id = $2
        LIMIT 1
        `,
        [orderId, userId]
      );

      const order = rows[0];

      if (!order || order.status !== "shipping") {
        return false;
      }

      /* 2️⃣ UPDATE ITEMS */
      await client.query(
        `
        UPDATE order_items
        SET
          status = 'completed',
          delivered_at = NOW()
        WHERE order_id = $1
        AND status = 'shipping'
        `,
        [orderId]
      );

      /* 3️⃣ UPDATE ORDER */
      await client.query(
        `
        UPDATE orders
        SET status = 'completed'
        WHERE id = $1
        `,
        [orderId]
      );

      return true;
    });
  } catch {
    throw new Error("FAILED_TO_COMPLETE_ORDER");
  }
}

/* =========================================================
   CREATE — RETURN REQUEST
========================================================= */
export async function createReturn(
  userId: string,
  orderId: string,
  orderItemId: string,
  reason: string,
  description: string | null,
  images: string[]
): Promise<void> {
  if (!userId || !orderId || !orderItemId) {
    throw new Error("INVALID_INPUT");
  }

  await withTransaction(async (client) => {
    /* ================= ORDER ================= */
    const { rows: orderRows } = await client.query<{
      id: string;
      buyer_id: string;
      seller_id: string;
      status: string;
    }>(
      `
      SELECT id, buyer_id, seller_id, status
      FROM orders
      WHERE id = $1 AND buyer_id = $2
      LIMIT 1
      `,
      [orderId, userId]
    );

    const order = orderRows[0];

    if (!order) {
      throw new Error("ORDER_NOT_FOUND");
    }

    if (!["completed", "delivered"].includes(order.status)) {
      throw new Error("ORDER_NOT_RETURNABLE");
    }

    /* ================= ITEM ================= */
    const { rows: itemRows } = await client.query<{
      id: string;
      product_id: string;
      quantity: number;
      product_name: string;
      thumbnail: string;
      unit_price: number;
    }>(
      `
      SELECT
        id,
        product_id,
        quantity,
        product_name,
        thumbnail,
        unit_price
      FROM order_items
      WHERE id = $1 AND order_id = $2
      LIMIT 1
      `,
      [orderItemId, orderId]
    );

    const item = itemRows[0];

    if (!item) {
      throw new Error("ITEM_NOT_FOUND");
    }

    /* ================= DUPLICATE ================= */
    const { rows: existing } = await client.query(
      `
      SELECT id
      FROM returns
      WHERE order_item_id = $1
      LIMIT 1
      `,
      [orderItemId]
    );

    if (existing.length > 0) {
      throw new Error("RETURN_EXISTS");
    }

    /* ================= INSERT ================= */
    const refundAmount = item.unit_price * item.quantity;

    await client.query(
      `
      INSERT INTO returns (
        order_id,
        order_item_id,
        product_id,
        seller_id,
        buyer_id,
        product_name,
        product_thumbnail,
        quantity,
        reason,
        description,
        images,
        refund_amount,
        status
      )
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,
        $9,$10,$11,
        $12,'pending'
      )
      `,
      [
        orderId,
        orderItemId,
        item.product_id,
        order.seller_id,
        userId,
        item.product_name,
        item.thumbnail,
        item.quantity,
        reason,
        description,
        JSON.stringify(images),
        refundAmount,
      ]
    );
  });
}

type PreviewItemInput = {
  product_id: string;
  quantity: number;
};

type PreviewOrderInput = {
  userId: string;
  items: PreviewItemInput[];
};

type PreviewOrderResult = {
  items: {
    product_id: string;
    name: string;
    price: number;
    quantity: number;
    total: number;
  }[];
  subtotal: number;
  shipping_fee: number;
  total: number;
};

export async function previewOrder(
  input: PreviewOrderInput
): Promise<PreviewOrderResult> {
  const { userId, items, country, zone } = input;

  if (!userId) throw new Error("INVALID_USER");
  if (!country) throw new Error("MISSING_COUNTRY");
  if (!zone) throw new Error("MISSING_REGION");

  /* ================= ZONE FROM COUNTRY ================= */

  const { rows: zoneRows } = await query<{ code: string }>(
    `
    SELECT sz.code
    FROM shipping_zone_countries szc
    JOIN shipping_zones sz ON sz.id = szc.zone_id
    WHERE szc.country_code = $1
    LIMIT 1
    `,
    [country.toUpperCase()]
  );

  if (!zoneRows.length) {
    throw new Error("INVALID_COUNTRY");
  }

  const realZone = zoneRows[0].code;
console.log("🟡 [PREVIEW][ZONE_CHECK]", {
  zone,
  realZone,
});
  /* ================= VALIDATE REGION ================= */

  if (zone !== realZone) {
  throw new Error("INVALID_REGION");
}

  /* ================= VALIDATE ITEMS ================= */

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("INVALID_ITEMS");
  }

  const productIds = items.map((i) => i.product_id);

  /* ================= GET PRODUCTS ================= */

  const { rows: products } = await query<{
    id: string;
    name: string;
    price: number;
  }>(
    `
    SELECT id, name, price
    FROM products
    WHERE id = ANY($1::uuid[])
    `,
    [productIds]
  );

  if (!products.length) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  /* ================= BUILD ITEMS ================= */

  let subtotal = 0;

  const previewItems = items.map((item) => {
    const p = productMap.get(item.product_id);

    if (!p) {
      throw new Error("INVALID_PRODUCT");
    }

    const qty =
      typeof item.quantity === "number" && item.quantity > 0
        ? item.quantity
        : 1;

    const total = Number(p.price) * qty;

    subtotal += total;

    return {
      product_id: p.id,
      name: p.name,
      price: Number(p.price),
      quantity: qty,
      total,
    };
  });

  /* ================= SHIPPING (PRODUCT BASED) ================= */

  const { rows: shippingRows } = await query<{
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

  if (!shippingRows.length) {
    throw new Error("SHIPPING_NOT_AVAILABLE");
  }

  /* ================= MAP SHIPPING ================= */

  const shippingMap = new Map(
    shippingRows.map((r) => [r.product_id, Number(r.price)])
  );

  /* ================= CALC SHIPPING ================= */

  // 👉 app bạn hiện chỉ cho 1 sản phẩm
  const firstItem = items[0];

  const shippingPrice = shippingMap.get(firstItem.product_id);

  if (shippingPrice === undefined) {
    throw new Error("SHIPPING_NOT_AVAILABLE");
  }

  const shippingFee = shippingPrice;

  /* ================= TOTAL ================= */

  return {
    items: previewItems,
    subtotal,
    shipping_fee: shippingFee,
    total: subtotal + shippingFee,
  };
}

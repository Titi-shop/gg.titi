
import { query } from "@/lib/db";
import { PoolClient } from "pg";

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
    SELECT *
    FROM cart_items
    WHERE buyer_id = $1
    ORDER BY created_at DESC
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
  quantity: number;
  paymentId: string;
  txid: string;
}) {
  function isUUID(v: string): boolean {
    return /^[0-9a-f-]{36}$/i.test(v);
  }

  if (!isUUID(params.productId)) {
    throw new Error("INVALID_PRODUCT_ID");
  }

  if (
    typeof params.quantity !== "number" ||
    !Number.isInteger(params.quantity) ||
    params.quantity < 1
  ) {
    throw new Error("INVALID_QUANTITY");
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

    if (Number.isNaN(price) || price < 0) {
      throw new Error("INVALID_PRICE");
    }

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

    if (!addr) throw new Error("NO_ADDRESS");

    /* ================= STOCK ================= */
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

    if (!stock.rowCount) {
      throw new Error("OUT_OF_STOCK");
    }

    const total = price * params.quantity;

    /* ================= ORDER ================= */
    const orderRes = await client.query(
      `
      INSERT INTO orders (
        order_number,
        buyer_id,
        pi_payment_id,
        pi_txid,
        total,
        shipping_name,
        shipping_phone,
        shipping_address
      )
      VALUES (
        gen_random_uuid()::text,
        $1,$2,$3,$4,$5,$6,$7
      )
      RETURNING id
      `,
      [
        params.userId,
        params.paymentId,
        params.txid,
        total,
        addr.full_name,
        addr.phone,
        addr.address_line,
      ]
    );

    const orderId = orderRes.rows[0].id;

    /* ================= ITEM ================= */
    await client.query(
      `
      INSERT INTO order_items (
        order_id,
        product_id,
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
        product.seller_id,
        product.name,
        product.thumbnail ?? "",
        price,
        params.quantity,
        total,
      ]
    );

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

    if (typeof item.product_id !== "string") continue;

    const qty =
      typeof item.quantity === "number" &&
      !Number.isNaN(item.quantity) &&
      item.quantity > 0
        ? Math.min(item.quantity, 99)
        : 1;

    productIds.push(item.product_id);
    variantIds.push(
      typeof item.variant_id === "string" ? item.variant_id : null
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
    ON CONFLICT (buyer_id, product_id, variant_id)
    DO UPDATE SET
      quantity = EXCLUDED.quantity,
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
  const { userId, items } = input;

  if (!userId) throw new Error("INVALID_USER");
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("EMPTY_ITEMS");
  }

  /* ================= GET PRODUCTS ================= */

  const productIds = items.map((i) => i.product_id);

  const { rows: products } = await query<{
    id: string;
    name: string;
    price: number;
    seller_id: string;
  }>(
    `
    SELECT id, name, price, seller_id
    FROM products
    WHERE id = ANY($1)
    `,
    [productIds]
  );

  if (products.length === 0) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  /* ================= MAP ================= */

  const productMap = new Map(products.map((p) => [p.id, p]));

  const previewItems: PreviewOrderResult["items"] = [];

  let subtotal = 0;

  for (const item of items) {
    const p = productMap.get(item.product_id);
    if (!p) continue;

    const qty =
      typeof item.quantity === "number" &&
      item.quantity > 0 &&
      item.quantity <= 99
        ? item.quantity
        : 1;

    const total = Number(p.price) * qty;

    subtotal += total;

    previewItems.push({
      product_id: p.id,
      name: p.name,
      price: Number(p.price),
      quantity: qty,
      total,
    });
  }

  if (previewItems.length === 0) {
    throw new Error("INVALID_ITEMS");
  }

  /* ================= SHIPPING ================= */
  // 🚨 TẠM FIX: lấy shipping của seller đầu tiên
  // vì bạn đang dùng 1 giá ship cho toàn shop

  const sellerId = products[0].seller_id;

  const { rows: shippingRows } = await query<{
    price: number;
  }>(
    `
    SELECT price
    FROM shipping_rates
    WHERE seller_id = $1
    LIMIT 1
    `,
    [sellerId]
  );

  const shippingFee =
    shippingRows.length > 0
      ? Number(shippingRows[0].price)
      : 0;

  /* ================= TOTAL ================= */

  const total = subtotal + shippingFee;

  return {
    items: previewItems,
    subtotal,
    shipping_fee: shippingFee,
    total,
  };
}

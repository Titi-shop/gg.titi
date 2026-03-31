lib/db/orders.ts

import { query } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

export type SellerOrderCount = {
  pending: number;
  confirmed: number;
  shipping: number;
  completed: number;
  returned: number;
  cancelled: number;
};

/* =========================================================
   GET — SELLER ORDER COUNTS
========================================================= */

export async function getSellerOrderCounts(
  sellerId: string
): Promise<SellerOrderCount> {
  if (!sellerId) {
    throw new Error("INVALID_SELLER_ID");
  }

  const { rows } = await query<{
    status: string;
    total: number;
  }>(
    `
    SELECT
      status,
      COUNT(DISTINCT order_id)::int AS total
    FROM order_items
    WHERE seller_id = $1
    GROUP BY status
    `,
    [sellerId]
  );

  const counts: SellerOrderCount = {
    pending: 0,
    confirmed: 0,
    shipping: 0,
    completed: 0,
    returned: 0,
    cancelled: 0,
  };

  for (const row of rows) {
    if (row.status in counts) {
      counts[row.status as keyof SellerOrderCount] = row.total;
    }
  }

  return counts;
}

/* =========================================================
   GET — SELLER ORDERS (PAGINATION)
========================================================= */

export type SellerOrderItem = {
  id: string;
  product_id: string;
  product_name: string;
  thumbnail: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: string;
};

export type SellerOrder = {
  id: string;
  order_number: string;
  created_at: string;

  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_provider: string | null;
  shipping_country: string | null;
  shipping_postal_code: string | null;

  order_items: SellerOrderItem[];
  total: number;
};

export async function getSellerOrders(
  sellerId: string,
  status?: string,
  page: number = 1,
  limit: number = 20
): Promise<SellerOrder[]> {
  if (!sellerId) {
    throw new Error("INVALID_SELLER_ID");
  }

  const offset = (page - 1) * limit;

  let statusFilter = "";
  const params: unknown[] = [sellerId];
  let paramIndex = 2;

  if (status) {
    statusFilter = `AND oi.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  const limitIndex = paramIndex++;
  const offsetIndex = paramIndex++;

  params.push(limit);
  params.push(offset);

  const { rows } = await query<SellerOrder>(
    `
    SELECT
      o.id,
      o.order_number,
      o.created_at,

      o.shipping_name,
      o.shipping_phone,
      o.shipping_address,
      o.shipping_provider,
      o.shipping_country,
      o.shipping_postal_code,

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
        ORDER BY oi.created_at ASC
      ) AS order_items,

      SUM(oi.total_price)::float AS total

    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id

    WHERE oi.seller_id = $1
    ${statusFilter}

    GROUP BY
      o.id,
      o.order_number,
      o.created_at,
      o.shipping_name,
      o.shipping_phone,
      o.shipping_address,
      o.shipping_provider,
      o.shipping_country,
      o.shipping_postal_code

    ORDER BY o.created_at DESC

    LIMIT $${limitIndex}
    OFFSET $${offsetIndex}
    `,
    params
  );

  return rows;
}

/* =========================================================
   GET — SELLER ORDER DETAIL
========================================================= */

export type SellerOrderDetail = {
  id: string;
  order_number: string;
  created_at: string;

  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_provider: string | null;
  shipping_country: string | null;
  shipping_postal_code: string | null;

  order_items: {
    id: string;
    product_id: string;
    product_name: string;
    thumbnail: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    status: string;
    tracking_code?: string | null;
    seller_message?: string | null;
  }[];

  total: number;
};

export async function getSellerOrderById(
  orderId: string,
  sellerId: string
): Promise<SellerOrderDetail | null> {
  if (!orderId || !sellerId) {
    throw new Error("INVALID_INPUT");
  }

  const { rows } = await query<SellerOrderDetail>(
    `
    SELECT
      o.id,
      o.order_number,
      o.created_at,

      o.shipping_name,
      o.shipping_phone,
      o.shipping_address,
      o.shipping_provider,
      o.shipping_country,
      o.shipping_postal_code,

      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'thumbnail', COALESCE(oi.thumbnail, ''),
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price,
            'status', oi.status,
            'tracking_code', oi.tracking_code,
            'seller_message', oi.seller_message
          )
          ORDER BY oi.created_at ASC
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'::json
      ) AS order_items,

      COALESCE(SUM(oi.total_price), 0)::float AS total

    FROM orders o

    LEFT JOIN order_items oi
      ON oi.order_id = o.id
      AND oi.seller_id = $2

    WHERE o.id = $1

    GROUP BY
      o.id,
      o.order_number,
      o.created_at,
      o.shipping_name,
      o.shipping_phone,
      o.shipping_address,
      o.shipping_provider,
      o.shipping_country,
      o.shipping_postal_code
    `,
    [orderId, sellerId]
  );

  if (!rows.length) return null;

  return rows[0];
}

/* =========================================================
   PATCH — SELLER CANCEL ORDER ITEMS
========================================================= */

export async function cancelOrderBySeller(
  orderId: string,
  sellerId: string,
  reason: string | null
): Promise<boolean> {
  if (!orderId || !sellerId) {
    throw new Error("INVALID_INPUT");
  }

  const result = await query(
    `
    UPDATE order_items
    SET
      status = 'cancelled',
      seller_cancel_reason = $3
    WHERE order_id = $1
    AND seller_id = $2
    AND status IN ('pending','confirmed')
    `,
    [orderId, sellerId, reason]
  );

  return (result.rowCount ?? 0) > 0;
}

/* =========================================================
   PATCH — SELLER START SHIPPING
========================================================= */

export async function startShippingBySeller(
  orderId: string,
  sellerId: string
): Promise<boolean> {
  if (!orderId || !sellerId) {
    throw new Error("INVALID_INPUT");
  }

  const result = await query(
    `
    UPDATE order_items
    SET
      status = 'shipping',
      shipped_at = NOW()
    WHERE order_id = $1
    AND seller_id = $2
    AND status = 'confirmed'
    `,
    [orderId, sellerId]
  );

  return (result.rowCount ?? 0) > 0;
}


/* =========================================================
   PATCH — SELLER CONFIRM ORDER
========================================================= */

export async function confirmOrderBySeller(
  orderId: string,
  sellerId: string,
  message: string | null
): Promise<boolean> {
  return withTransaction(async (client) => {
    const itemResult = await client.query(
      `
      UPDATE order_items
      SET status = 'confirmed',
          seller_message = $3
      WHERE order_id = $1
      AND seller_id = $2
      AND status = 'pending'
      `,
      [orderId, sellerId, message]
    );

    if (!itemResult.rowCount) return false;

    const { rows } = await client.query<{ pending: number }>(
      `
      SELECT COUNT(*)::int AS pending
      FROM order_items
      WHERE order_id = $1
      AND status = 'pending'
      `,
      [orderId]
    );

    if (rows[0].pending === 0) {
      await client.query(
        `
        UPDATE orders
        SET status = 'pickup'
        WHERE id = $1
        `,
        [orderId]
      );
    }

    return true;
  });
}

/* =========================================================
   GET — BUYER ORDER COUNTS
========================================================= */

export type BuyerOrderCount = {
  pending: number;
  pickup: number;
  shipping: number;
  completed: number;
  cancelled: number;
};

export async function getBuyerOrderCounts(
  userId: string
): Promise<BuyerOrderCount> {
  if (!userId) {
    throw new Error("INVALID_USER_ID");
  }

  const { rows } = await query<BuyerOrderCount>(
    `
    SELECT
      COUNT(*) FILTER (WHERE o.status='pending')::int AS pending,
      COUNT(*) FILTER (WHERE o.status='pickup')::int AS pickup,
      COUNT(*) FILTER (WHERE o.status='shipping')::int AS shipping,

      COUNT(DISTINCT o.id) FILTER (
        WHERE o.status='completed'
        AND EXISTS (
          SELECT 1
          FROM order_items oi
          WHERE oi.order_id = o.id
          AND NOT EXISTS (
            SELECT 1
            FROM reviews r
            WHERE r.order_item_id = oi.id
            AND r.user_id = $1
          )
        )
      )::int AS completed,

      COUNT(*) FILTER (WHERE o.status='cancelled')::int AS cancelled

    FROM orders o
    WHERE o.buyer_id = $1
    `,
    [userId]
  );

  return rows[0] ?? {
    pending: 0,
    pickup: 0,
    shipping: 0,
    completed: 0,
    cancelled: 0,
  };
}

/* =========================================================
   GET — ORDERS BY BUYER
========================================================= */

type OrderRow = {
  id: string;
  order_number: string;
  buyer_id: string;
  status: string;
  total: number;
  created_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  seller_id: string;

  product_name: string;
  thumbnail: string;

  unit_price: number;
  quantity: number;
  total_price: number;

  status: string;

  seller_message: string | null;
  seller_cancel_reason: string | null;
};

export async function getOrdersByBuyer(
  userId: string
): Promise<
  {
    id: string;
    order_number: string;
    status: string;
    total: number;
    created_at: string;
    order_items: OrderItemRow[];
  }[]
> {
  if (!userId) {
    throw new Error("INVALID_USER_ID");
  }

  /* =========================
     1️⃣ LOAD ORDERS
  ========================= */

  const { rows: orders } = await query<OrderRow>(
    `
    select
      id,
      order_number,
      buyer_id,
      status,
      total,
      created_at
    from orders
    where buyer_id = $1
    order by created_at desc
    `,
    [userId]
  );

  if (!orders.length) {
    return [];
  }

  const orderIds = orders.map((o) => o.id);

  /* =========================
     2️⃣ LOAD ORDER ITEMS
  ========================= */

  const { rows: items } = await query<OrderItemRow>(
    `
    select
      id,
      order_id,
      product_id,
      seller_id,
      product_name,
      thumbnail,
      unit_price,
      quantity,
      total_price,
      status,
      seller_message,
      seller_cancel_reason
    from order_items
    where order_id = any($1::uuid[])
    order by created_at asc
    `,
    [orderIds]
  );

  /* =========================
     3️⃣ GROUP ITEMS
  ========================= */

  const map = new Map<string, OrderItemRow[]>();

  for (const item of items) {
    if (!map.has(item.order_id)) {
      map.set(item.order_id, []);
    }
    map.get(item.order_id)!.push(item);
  }

  /* =========================
     4️⃣ BUILD RESPONSE
  ========================= */

  return orders.map((order) => ({
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    total: Number(order.total),
    created_at: order.created_at,
    order_items: map.get(order.id) ?? [],
  }));
}


export async function completeOrderByBuyer(
  orderId: string,
  userId: string
): Promise<boolean> {
  // check order
  const { rows } = await query(
    `
    select status
    from orders
    where id=$1 and buyer_id=$2
    `,
    [orderId, userId]
  );

  const order = rows[0];

  if (!order || order.status !== "shipping") {
    return false;
  }

  // update items
  const result = await query(
    `
    update order_items
    set
      status='completed',
      delivered_at=now()
    where order_id=$1
    and status='shipping'
    `,
    [orderId]
  );

  return result.rowCount > 0;
}

export async function cancelOrderByBuyer(
  orderId: string,
  userId: string,
  reason: string
): Promise<"OK" | "NOT_FOUND" | "FORBIDDEN" | "INVALID_STATUS"> {
  const { rows } = await query(
    `
    select buyer_id, status
    from orders
    where id=$1
    `,
    [orderId]
  );

  const order = rows[0];

  if (!order) return "NOT_FOUND";

  if (order.buyer_id !== userId) return "FORBIDDEN";

  if (order.status !== "pending") return "INVALID_STATUS";

  // update items
  await query(
    `
    update order_items
    set
      status='cancelled',
      seller_cancel_reason=$2
    where order_id=$1
    and status='pending'
    `,
    [orderId, reason]
  );

  // update order
  await query(
    `
    update orders
    set
      status='cancelled',
      cancel_reason=$2,
      cancelled_at=now()
    where id=$1
    `,
    [orderId, reason]
  );

  return "OK";
}

export async function getOrderByBuyerId(
  orderId: string,
  userId: string
) {
  const { rows } = await query(
    `
    select
      o.id,
      o.total,
      o.status,
      o.created_at,

      coalesce(
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
          order by oi.created_at asc
        ) filter (where oi.id is not null),
        '[]'
      ) as order_items

    from orders o
    join order_items oi on oi.order_id = o.id

    where o.id = $1
    and o.buyer_id = $2

    group by o.id
    `,
    [orderId, userId]
  );

  return rows[0] ?? null;
}


export async function createReturn(
  userId: string,
  orderId: string,
  orderItemId: string,
  reason: string,
  description: string | null,
  images: string[]
): Promise<void> {
  /* ================= ORDER ================= */
  const { rows: orderRows } = await query(
    `
    SELECT id, buyer_id, seller_id, status
    FROM orders
    WHERE id = $1 AND buyer_id = $2
    LIMIT 1
    `,
    [orderId, userId]
  );

  const order = orderRows[0];
  if (!order) throw new Error("ORDER_NOT_FOUND");

  if (!["completed", "delivered"].includes(order.status)) {
    throw new Error("ORDER_NOT_RETURNABLE");
  }

  /* ================= ITEM ================= */
  const { rows: itemRows } = await query(
    `
    SELECT
      id,
      product_id,
      quantity,
      product_name,
      product_thumbnail,
      unit_price
    FROM order_items
    WHERE id = $1 AND order_id = $2
    LIMIT 1
    `,
    [orderItemId, orderId]
  );

  const item = itemRows[0];
  if (!item) throw new Error("ITEM_NOT_FOUND");

  /* ================= DUPLICATE ================= */
  const { rows: existing } = await query(
    `
    SELECT id FROM returns
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

  await query(
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
      item.product_thumbnail,
      item.quantity,
      reason,
      description,
      JSON.stringify(images),
      refundAmount,
    ]
  );
}

export async function getReturnsByBuyer(userId: string) {
  const { rows } = await query(
    `
    select 
      r.id,
      r.order_id,
      r.order_item_id,
      r.reason,
      r.description,
      r.status,
      r.created_at,

      json_agg(ri.image_url) as images

    from returns r
    left join return_images ri 
      on ri.return_id = r.id

    where r.buyer_id = $1

    group by r.id
    order by r.created_at desc
    `,
    [userId]
  );

  return rows.map((r) => ({
    id: r.id,
    order_id: r.order_id,
    order_item_id: r.order_item_id,
    reason: r.reason,
    description: r.description,
    status: r.status,
    created_at: r.created_at,
    images: r.images ?? [],
  }));
}

export async function getCartByBuyer(userId: string) {
  const { rows } = await query(
    `
    select 
      c.id,
      c.product_id,
      c.variant_id,
      c.quantity,

      p.name,
      p.sale_price,
      p.price,
      p.thumbnail,
      p.stock

    from cart_items c
    left join products p on p.id = c.product_id

    where c.buyer_id = $1
    order by c.created_at desc
    `,
    [userId]
  );

  return rows.map((r) => ({
    id: r.variant_id
      ? `${r.product_id}-${r.variant_id}`
      : r.product_id,

    product_id: r.product_id,
    variant_id: r.variant_id,

    name: r.name ?? "Unknown product",

    price: Number(r.price ?? 0),
    sale_price: r.sale_price ? Number(r.sale_price) : null,

    thumbnail: r.thumbnail ?? "",
    stock: r.stock ?? 0,
    quantity: r.quantity ?? 1,
  }));
}

export async function upsertCartItems(
  userId: string,
  items: {
    product_id: string;
    variant_id?: string | null;
    quantity?: number;
  }[]
): Promise<void> {
  for (const item of items) {
    if (!item.product_id) continue;

    await query(
  `
  insert into cart_items (buyer_id, product_id, variant_id, quantity)
  values ($1, $2, $3, $4)
  on conflict (buyer_id, product_id, variant_id)
  do update set
    quantity = excluded.quantity,
    updated_at = now()
  `,
  [
    userId,
    item.product_id,
    item.variant_id ?? null,
    item.quantity ?? 1,
  ]
);
  }
}

export async function deleteCartItem(
  userId: string,
  productId: string,
  variantId?: string | null
): Promise<void> {
  await query(
    `
    delete from cart_items
    where buyer_id = $1
      and product_id = $2
      and variant_id IS NOT DISTINCT FROM $3::uuid
    `,
    [userId, productId, variantId ?? null]
  );
}

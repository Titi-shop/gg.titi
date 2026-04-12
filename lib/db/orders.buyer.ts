import { query, withTransaction } from "@/lib/db";

/* =========================================================
   BUYER — ORDERS LIST
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

/* =========================================================
   BUYER — COUNTS
========================================================= */
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

/* =========================================================
   BUYER — ORDER DETAIL
========================================================= */
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

export async function completeOrderByBuyer(
  orderId: string,
  userId: string
): Promise<boolean> {
  if (!orderId || !userId) {
    throw new Error("INVALID_INPUT");
  }

  return withTransaction(async (client) => {
    /* ================= CHECK ORDER ================= */
    const { rows } = await client.query<{
      status: string;
    }>(
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

    if (!order) {
      return false;
    }

    /* ================= VALID STATUS ================= */
    if (order.status !== "shipping") {
      return false;
    }

    /* ================= UPDATE ITEMS ================= */
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

    /* ================= UPDATE ORDER ================= */
    await client.query(
      `
      UPDATE orders
      SET
        status = 'completed',
        delivered_at = NOW()
      WHERE id = $1
      `,
      [orderId]
    );

    return true;
  });
}

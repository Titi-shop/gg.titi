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
      o.payment_status,

      o.total,
      o.currency,
      o.items_total,
      o.shipping_fee,

      o.created_at,

      /* SHIPPING */
      o.shipping_name,
      o.shipping_phone,
      o.shipping_address_line,
      o.shipping_ward,
      o.shipping_district,
      o.shipping_region,
      o.shipping_country,
      o.shipping_postal_code,

      /* TIMELINE */
      o.confirmed_at,
      o.shipped_at,
      o.delivered_at,

      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'product_slug', oi.product_slug,
            'thumbnail', oi.thumbnail,
            'images', oi.images,
            'variant_name', oi.variant_name,
            'variant_value', oi.variant_value,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price,
            'seller_message', oi.seller_message,
            'seller_cancel_reason', oi.seller_cancel_reason,
            'currency', oi.currency,
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
      COUNT(*) FILTER (WHERE status='confirmed')::int AS confirmed,
      COUNT(*) FILTER (WHERE status='shipping')::int AS shipping,
      COUNT(*) FILTER (WHERE status='completed')::int AS completed,
      COUNT(*) FILTER (WHERE status='cancelled')::int AS cancelled
    FROM orders
    WHERE buyer_id = $1
      AND deleted_at IS NULL
    `,
    [userId]
  );

  return rows[0] ?? {
    pending: 0,
    confirmed: 0,
    shipping: 0,
    completed: 0,
    cancelled: 0,
  };
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
      o.order_number,
      o.status,
      o.payment_status,

      o.total,
      o.currency,

      o.items_total,
      o.subtotal,
      o.discount,
      o.shipping_fee,
      o.tax,

      o.created_at,

      /* SHIPPING */
      o.shipping_name,
      o.shipping_phone,
      o.shipping_address_line,
      o.shipping_ward,
      o.shipping_district,
      o.shipping_region,
      o.shipping_country,
      o.shipping_postal_code,
      o.shipping_provider,
      o.shipping_zone,

      /* TIMELINE */
      o.confirmed_at,
      o.shipped_at,
      o.delivered_at,
      o.cancelled_at,

      /* NOTE */
      o.buyer_note,
      o.admin_note,

      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id,
            'product_id', oi.product_id,

            'product_name', oi.product_name,
            'product_slug', oi.product_slug,

            'thumbnail', oi.thumbnail,
            'images', oi.images,

            'variant_name', oi.variant_name,
            'variant_value', oi.variant_value,

            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price,

            'currency', oi.currency,
            'status', oi.status,
           'seller_message', oi.seller_message,
           'seller_cancel_reason', oi.seller_cancel_reason,
            'tracking_code', oi.tracking_code,
            'shipping_provider', oi.shipping_provider,

            'shipped_at', oi.shipped_at,
            'delivered_at', oi.delivered_at,

            'snapshot', oi.snapshot
          )
        ) FILTER (WHERE oi.id IS NOT NULL),
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

export async function cancelOrderByBuyer(
  orderId: string,
  userId: string,
  reason?: string
) {
  try {
    /* ================= UPDATE ORDER ================= */
    const res = await query(
      `
      UPDATE orders
      SET 
        status = 'cancelled',
        cancel_reason = $3,
        cancelled_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
        AND buyer_id = $2
        AND status = 'pending'
      RETURNING id
      `,
      [orderId, userId, reason || null]
    );

    if (res.rowCount === 0) return false;

    /* ================= UPDATE ITEMS ================= */
    await query(
      `
      UPDATE order_items
      SET status = 'cancelled'
      WHERE order_id = $1
      `,
      [orderId]
    );

    return true;

  } catch (err) {
    console.error("cancelOrderByBuyer error:", err);
    return false;
  }
}

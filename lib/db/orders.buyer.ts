import {
  query,
  withTransaction,
} from "@/lib/db";

import {
  syncOrderFulfillmentStatus,
} from "@/lib/db/orders";

/* =========================================================
   TYPES
========================================================= */

export type OrderPaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded";

export type OrderFulfillmentStatus =
  | "pending"
  | "pending_fulfillment"
  | "processing"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled"
  | "refunded";

export type BuyerOrderItemRow = {
  id: string;

  product_id: string;

  product_name: string | null;
  product_slug: string | null;

  thumbnail: string | null;

  images: unknown;

  variant_name: string | null;
  variant_value: string | null;

  quantity: number;

  unit_price: string;
  total_price: string;

  currency: string;

  fulfillment_status: string;

  seller_message: string | null;
  seller_cancel_reason: string | null;

  tracking_code: string | null;
  shipping_provider: string | null;

  shipped_at: string | null;
  delivered_at: string | null;

  snapshot: unknown;
};

export type BuyerOrderRow = {
  id: string;
  order_number: string;

  payment_status: OrderPaymentStatus;
  fulfillment_status: OrderFulfillmentStatus;

  total: string;
  currency: string;

  items_total: string;
  subtotal: string;
  discount: string;
  shipping_fee: string;
  tax: string;

  created_at: string;

  paid_at: string | null;

  fulfillment_started_at: string | null;
  processing_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;

  cancelled_at: string | null;
  cancel_reason: string | null;

  shipping_name: string;
  shipping_phone: string;
  shipping_address_line: string;

  shipping_ward: string | null;
  shipping_district: string | null;
  shipping_region: string | null;

  shipping_country: string;
  shipping_postal_code: string | null;

  shipping_provider: string | null;
  shipping_zone: string | null;

  buyer_note: string;
  admin_note: string;

  total_items: number;
  total_quantity: number;

  order_items: BuyerOrderItemRow[];
};


/* =========================================================
   BUYER — ORDERS LIST
========================================================= */

export async function getOrdersByBuyer(
  userId: string
): Promise<BuyerOrderRow[]> {
  const { rows } = await query<BuyerOrderRow>(
    `
    SELECT
      o.id,
      o.order_number,

      o.payment_status,
      o.fulfillment_status,

      o.total,
      o.currency,

      o.items_total,
      o.subtotal,
      o.discount,
      o.shipping_fee,
      o.tax,

      o.created_at,
      o.paid_at,

      o.fulfillment_started_at,
      o.processing_at,
      o.shipped_at,
      o.delivered_at,
      o.completed_at,

      o.cancelled_at,
      o.cancel_reason,

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

      o.buyer_note,
      o.admin_note,

      o.total_items,
      o.total_quantity,

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
      'fulfillment_status', oi.fulfillment_status,
      'seller_message', oi.seller_message,
      'seller_cancel_reason', oi.seller_cancel_reason,
      'tracking_code', oi.tracking_code,
      'shipping_provider', oi.shipping_provider,
      'shipped_at', oi.shipped_at,
      'delivered_at', oi.delivered_at,
      'snapshot', oi.snapshot
    )
  ) FILTER (WHERE oi.id IS NOT NULL),
  '[]'::json
) AS order_items

    FROM orders o
    LEFT JOIN order_items oi
      ON oi.order_id = o.id

    WHERE o.buyer_id = $1
      AND o.deleted_at IS NULL

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

export type BuyerOrderCounts = {
  pending_fulfillment: number;
  processing: number;
  shipped: number;
  delivered: number;
  completed: number;
  cancelled: number;
  refunded: number;
};

export async function getBuyerOrderCounts(
  userId: string
): Promise<BuyerOrderCounts> {
  const { rows } = await query<{
    fulfillment_status: string;
    total: number;
  }>(
    `
    SELECT
      fulfillment_status,
      COUNT(*)::int AS total
    FROM orders
    WHERE buyer_id = $1
      AND deleted_at IS NULL
    GROUP BY fulfillment_status
    `,
    [userId]
  );

  const counts: BuyerOrderCounts = {
    pending_fulfillment: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    completed: 0,
    cancelled: 0,
    refunded: 0,
  };

  for (const row of rows) {
    const status =
      row.fulfillment_status;

    const total = Number(
      row.total ?? 0
    );

    if (
      status in counts
    ) {
      counts[
        status as keyof BuyerOrderCounts
      ] = total;
    }
  }

  return counts;
}

/* =========================================================
   BUYER — ORDER DETAIL
========================================================= */

export async function getOrderByBuyerId(
  orderId: string,
  userId: string
): Promise<BuyerOrderRow | null> {
  const startedAt = Date.now();

  try {
    /* =====================================================
       QUERY START
    ===================================================== */
    console.log("[DB][ORDER][BUYER_DETAIL][START]", {
      orderId,
      userId,
      timestamp: new Date().toISOString(),
    });

    /* =====================================================
       EXECUTE QUERY
    ===================================================== */
    console.log("[DB][ORDER][BUYER_DETAIL][QUERY_EXECUTE]", {
      orderId,
      userId,
    });

    const { rows } = await query<BuyerOrderRow>(
      `
      SELECT
        o.id,
        o.order_number,

        o.payment_status,
        o.fulfillment_status,

        o.total,
        o.currency,

        o.items_total,
        o.subtotal,
        o.discount,
        o.shipping_fee,
        o.tax,

        o.created_at,
        o.paid_at,

        o.fulfillment_started_at,
        o.processing_at,
        o.shipped_at,
        o.delivered_at,
        o.completed_at,

        o.cancelled_at,
        o.cancel_reason,

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

        o.buyer_note,
        o.admin_note,

        o.total_items,
        o.total_quantity,

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
      'fulfillment_status', oi.fulfillment_status,
      'seller_message', oi.seller_message,
      'seller_cancel_reason', oi.seller_cancel_reason,
      'tracking_code', oi.tracking_code,
      'shipping_provider', oi.shipping_provider,
      'shipped_at', oi.shipped_at,
      'delivered_at', oi.delivered_at,
      'snapshot', oi.snapshot
    )
  ) FILTER (WHERE oi.id IS NOT NULL),
  '[]'::json
) AS order_items

      FROM orders o
      LEFT JOIN order_items oi
        ON oi.order_id = o.id

      WHERE o.id = $1
        AND o.buyer_id = $2
        AND o.deleted_at IS NULL

      GROUP BY o.id
      `,
      [orderId, userId]
    );

    /* =====================================================
       QUERY RESULT
    ===================================================== */
    console.log("[DB][ORDER][BUYER_DETAIL][QUERY_SUCCESS]", {
      orderId,
      userId,
      rowsCount: rows.length,
      durationMs: Date.now() - startedAt,
    });

    const order = rows[0] ?? null;

    /* =====================================================
       NOT FOUND
    ===================================================== */
    if (!order) {
      console.warn("[DB][ORDER][BUYER_DETAIL][NOT_FOUND]", {
        orderId,
        userId,
        durationMs: Date.now() - startedAt,
      });

      return null;
    }

    /* =====================================================
       SUCCESS
    ===================================================== */
    console.log("[DB][ORDER][BUYER_DETAIL][FOUND]", {
      orderId: order.id,
      orderNumber: order.order_number ?? null,

      paymentStatus: order.payment_status ?? null,
      fulfillmentStatus: order.fulfillment_status ?? null,

      total: order.total ?? null,
      currency: order.currency ?? null,

      totalItems: order.total_items ?? 0,
      totalQuantity: order.total_quantity ?? 0,

      itemsCount: Array.isArray(order.order_items)
        ? order.order_items.length
        : 0,

      createdAt: order.created_at ?? null,
      paidAt: order.paid_at ?? null,

      durationMs: Date.now() - startedAt,
    });

    return order;

  } catch (err) {
    /* =====================================================
       ERROR
    ===================================================== */
    console.error("[DB][ORDER][BUYER_DETAIL][ERROR]", {
      orderId,
      userId,
      durationMs: Date.now() - startedAt,

      message:
        err instanceof Error
          ? err.message
          : "UNKNOWN_ERROR",

      stack:
        err instanceof Error
          ? err.stack
          : undefined,
    });

    throw err;

  } finally {
    /* =====================================================
       END
    ===================================================== */
    console.log("[DB][ORDER][BUYER_DETAIL][END]", {
      orderId,
      userId,
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  }
}
/* =========================================================
   COMPLETE ORDER
========================================================= */

export type CompleteResult =
  | "SUCCESS"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_STATUS";

export async function completeOrderByBuyer(
  orderId: string,
  userId: string
): Promise<CompleteResult> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{
      buyer_id: string;
      fulfillment_status: OrderFulfillmentStatus;
    }>(
      `
      SELECT
        buyer_id,
        fulfillment_status
      FROM orders
      WHERE id = $1
      LIMIT 1
      `,
      [orderId]
    );

    const order = rows[0];

    if (!order) {
      return "NOT_FOUND";
    }

    if (order.buyer_id !== userId) {
      return "FORBIDDEN";
    }

    if (order.fulfillment_status !== "shipped") {
      return "INVALID_STATUS";
    }

    /* ==========================================
       UPDATE ORDER ITEMS
    ========================================== */

    await client.query(
      `
      UPDATE order_items
      SET
        fulfillment_status = 'delivered',
        delivered_at = NOW(),
        updated_at = NOW()
      WHERE order_id = $1
        AND fulfillment_status = 'shipped'
      `,
      [orderId]
    );

    /* ==========================================
       UPDATE ORDER
    ========================================== */

    await client.query(
      `
      UPDATE orders
      SET
        fulfillment_status = 'delivered',
        delivered_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      `,
      [orderId]
    );

    console.log("[ORDER][BUYER_RECEIVED]", {
      orderId,
      from: "shipped",
      to: "delivered",
    });

    return "SUCCESS";
  });
}

/* =========================================================
   CANCEL ORDER
========================================================= */

export type CancelResult =
  | "SUCCESS"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_STATUS";

export async function cancelOrderByBuyer(
  orderId: string,
  userId: string,
  reason?: string | null
): Promise<CancelResult> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{
      buyer_id: string;
      fulfillment_status: OrderFulfillmentStatus;
    }>(
      `
      SELECT
        buyer_id,
        fulfillment_status
      FROM orders
      WHERE id = $1
      LIMIT 1
      `,
      [orderId]
    );

    const order = rows[0];

    if (!order) {
      return "NOT_FOUND";
    }

    if (order.buyer_id !== userId) {
      return "FORBIDDEN";
    }

    /* ==========================================
       CHỈ CHO HỦY KHI CHƯA SHIP
    ========================================== */

    if (
      ![
        "pending",
        "pending_fulfillment",
        "processing",
      ].includes(order.fulfillment_status)
    ) {
      return "INVALID_STATUS";
    }

    /* ==========================================
       UPDATE ORDER ITEMS
    ========================================== */

    await client.query(
      `
      UPDATE order_items
      SET
        fulfillment_status = 'cancelled',
        seller_cancel_reason = COALESCE(
          $2,
          seller_cancel_reason
        ),
        updated_at = NOW()
      WHERE order_id = $1
        AND fulfillment_status IN (
          'pending',
          'pending_fulfillment',
          'processing'
        )
      `,
      [orderId, reason ?? null]
    );

    /* ==========================================
       UPDATE ORDER
    ========================================== */

    await client.query(
      `
      UPDATE orders
      SET
        fulfillment_status = 'cancelled',
        cancelled_at = NOW(),
        cancel_reason = COALESCE(
          $2,
          cancel_reason
        ),
        updated_at = NOW()
      WHERE id = $1
      `,
      [orderId, reason ?? null]
    );

    return "SUCCESS";
  });
}

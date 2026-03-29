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

import { query } from "@/lib/db";
import { PoolClient } from "pg";

/* =========================================================
   INTERNAL HELPER — TRANSACTION
========================================================= */

async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await (query as any).pool.connect(); // đảm bảo query export pool

  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   GET — SELLER ORDER COUNTS
========================================================= */

export async function getSellerOrderCounts(sellerId: string) {
  if (!sellerId) throw new Error("INVALID_SELLER_ID");

  const { rows } = await query(
    `
    SELECT status, COUNT(*)::int AS total
    FROM order_items
    WHERE seller_id = $1
    GROUP BY status
    `,
    [sellerId]
  );

  const counts: Record<string, number> = {
    pending: 0,
    confirmed: 0,
    shipping: 0,
    completed: 0,
    returned: 0,
    cancelled: 0,
  };

  for (const r of rows) {
    if (r.status in counts) counts[r.status] = r.total;
  }

  return counts;
}

/* =========================================================
   GET — SELLER ORDERS (NO N+1)
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
      o.shipping_provider,
      o.shipping_country,
      o.shipping_postal_code,

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
          ORDER BY oi.created_at ASC
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'
      ) AS order_items,

      COALESCE(SUM(oi.total_price),0)::float AS total

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
   TRANSACTION — CONFIRM ORDER
========================================================= */

export async function confirmOrderBySeller(
  orderId: string,
  sellerId: string,
  message: string | null
) {
  return withTransaction(async (client) => {
    const update = await client.query(
      `
      UPDATE order_items
      SET status='confirmed', seller_message=$3
      WHERE order_id=$1 AND seller_id=$2 AND status='pending'
      `,
      [orderId, sellerId, message]
    );

    if (!update.rowCount) return false;

    const { rows } = await client.query(
      `
      SELECT COUNT(*)::int AS pending
      FROM order_items
      WHERE order_id=$1 AND status='pending'
      `,
      [orderId]
    );

    if (rows[0].pending === 0) {
      await client.query(
        `UPDATE orders SET status='pickup' WHERE id=$1`,
        [orderId]
      );
    }

    return true;
  });
}

/* =========================================================
   TRANSACTION — CANCEL BY BUYER
========================================================= */

export async function cancelOrderByBuyer(
  orderId: string,
  userId: string,
  reason: string
) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT buyer_id, status FROM orders WHERE id=$1`,
      [orderId]
    );

    const order = rows[0];
    if (!order) return "NOT_FOUND";
    if (order.buyer_id !== userId) return "FORBIDDEN";
    if (order.status !== "pending") return "INVALID_STATUS";

    await client.query(
      `
      UPDATE order_items
      SET status='cancelled', seller_cancel_reason=$2
      WHERE order_id=$1
      `,
      [orderId, reason]
    );

    await client.query(
      `
      UPDATE orders
      SET status='cancelled', cancel_reason=$2, cancelled_at=NOW()
      WHERE id=$1
      `,
      [orderId, reason]
    );

    return "OK";
  });
}

/* =========================================================
   TRANSACTION — CREATE RETURN
========================================================= */

export async function createReturn(
  userId: string,
  orderId: string,
  orderItemId: string,
  reason: string,
  description: string | null,
  images: string[]
) {
  return withTransaction(async (client) => {
    const { rows: orderRows } = await client.query(
      `SELECT id, buyer_id, seller_id, status FROM orders WHERE id=$1 AND buyer_id=$2`,
      [orderId, userId]
    );

    const order = orderRows[0];
    if (!order) throw new Error("ORDER_NOT_FOUND");

    const { rows: itemRows } = await client.query(
      `SELECT * FROM order_items WHERE id=$1`,
      [orderItemId]
    );

    const item = itemRows[0];
    if (!item) throw new Error("ITEM_NOT_FOUND");

    const refund = item.unit_price * item.quantity;

    await client.query(
      `
      INSERT INTO returns (
        order_id, order_item_id, product_id,
        seller_id, buyer_id,
        product_name, product_thumbnail,
        quantity, reason, description,
        images, refund_amount, status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')
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
        refund,
      ]
    );
  });
}

/* =========================================================
   BATCH — UPSERT CART
========================================================= */

export async function upsertCartItems(
  userId: string,
  items: {
    product_id: string;
    variant_id?: string | null;
    quantity?: number;
  }[]
) {
  if (!items.length) return;

  const productIds = items.map((i) => i.product_id);
  const variantIds = items.map((i) => i.variant_id ?? null);
  const quantities = items.map((i) => i.quantity ?? 1);

  await query(
    `
    INSERT INTO cart_items (buyer_id, product_id, variant_id, quantity)
    SELECT $1, x.product_id, x.variant_id, x.quantity
    FROM UNNEST($2::uuid[], $3::uuid[], $4::int[]) 
    AS x(product_id, variant_id, quantity)
    ON CONFLICT (buyer_id, product_id, variant_id)
    DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()
    `,
    [userId, productIds, variantIds, quantities]
  );
}

/* =========================================================
   COMPLETE ORDER (FIXED)
========================================================= */

export async function completeOrderByBuyer(
  orderId: string,
  userId: string
) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT status FROM orders WHERE id=$1 AND buyer_id=$2`,
      [orderId, userId]
    );

    const order = rows[0];
    if (!order || order.status !== "shipping") return false;

    await client.query(
      `
      UPDATE order_items
      SET status='completed', delivered_at=NOW()
      WHERE order_id=$1
      `,
      [orderId]
    );

    await client.query(
      `UPDATE orders SET status='completed' WHERE id=$1`,
      [orderId]
    );

    return true;
  });
}

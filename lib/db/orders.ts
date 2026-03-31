
import { withTransaction } from "@/lib/db";
import { PoolClient } from "pg";

/* =========================================================
   TRANSACTION HELPER
========================================================= */

async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

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
  piUid: string;
  productId: string;
  quantity: number;
  paymentId: string;
  txid: string;
}) {
  return withTransaction(async (client) => {

    /* ================= USER ================= */
    const userRes = await client.query(
      `SELECT id FROM users WHERE pi_uid=$1 LIMIT 1`,
      [params.piUid]
    );

    if (!userRes.rows.length) {
      throw new Error("USER_NOT_FOUND");
    }

    const userId = userRes.rows[0].id;

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
      `SELECT * FROM products WHERE id=$1 LIMIT 1`,
      [params.productId]
    );

    const product = productRes.rows[0];

    if (!product || product.is_active === false || product.deleted_at) {
      throw new Error("PRODUCT_NOT_AVAILABLE");
    }

    /* ================= ADDRESS ================= */
    const addrRes = await client.query(
      `
      SELECT full_name, phone, address_line
      FROM addresses
      WHERE user_id=$1 AND is_default=true
      LIMIT 1
      `,
      [userId]
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

    /* ================= ORDER ================= */
    const total =
      Number(product.price) * params.quantity;

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
        userId,
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
        product.price,
        params.quantity,
        total,
      ]
    );

    return { orderId, duplicated: false };
  });
}

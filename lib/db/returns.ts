import { query, withTransaction } from "@/lib/db";

/* =====================================================
   TYPES
===================================================== */

type DbOrder = {
  id: string;
  seller_id: string;
  status: string;
};

type DbOrderItem = {
  id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  product_slug: string;
  thumbnail: string;
  unit_price: string; // numeric → string từ PG
  quantity: number;
};

type DbReturn = {
  id: string;
  return_number: string;
  status: string;
  refund_amount: string;
  currency: string;
  created_at: string;
};

/* =====================================================
   HELPERS
===================================================== */

function isValidUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

function toNumberSafe(value: unknown, field: string): number {
  const num = Number(value);

  if (Number.isNaN(num)) {
    console.error("❌ [RETURN][PARSE_ERROR]", {
      field,
      value,
    });
    throw new Error("INVALID_NUMBER");
  }

  return num;
}

function error(message: string): never {
  throw new Error(message);
}

/* =====================================================
   GET RETURNS
===================================================== */

export async function getReturnsByBuyer(
  buyerId: string
): Promise<DbReturn[]> {
  if (!isValidUuid(buyerId)) {
    error("INVALID_BUYER_ID");
  }

  const { rows } = await query<DbReturn>(
    `
    SELECT id, return_number, status, refund_amount, currency, created_at
    FROM returns
    WHERE buyer_id = $1
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    `,
    [buyerId]
  );

  return rows;
}

/* =====================================================
   GET DETAIL
===================================================== */

export async function getReturnByIdForBuyer(
  returnId: string,
  buyerId: string
) {
  if (!isValidUuid(returnId) || !isValidUuid(buyerId)) {
    error("INVALID_INPUT");
  }

  const { rows } = await query(
    `
    SELECT *
    FROM returns
    WHERE id = $1
      AND buyer_id = $2
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [returnId, buyerId]
  );

  return rows[0] ?? null;
}

/* =====================================================
   CREATE RETURN
===================================================== */

export async function createReturn(
  buyerId: string,
  orderId: string,
  orderItemId: string,
  reason: string,
  description: string,
  images: string[]
): Promise<string> {
  if (
    !isValidUuid(buyerId) ||
    !isValidUuid(orderId) ||
    !isValidUuid(orderItemId)
  ) {
    error("INVALID_INPUT");
  }

  if (!reason.trim()) {
    error("INVALID_REASON");
  }

  return withTransaction(async (client) => {
    console.log("🚀 [RETURN] START", {
      buyerId,
      orderId,
      orderItemId,
    });

    /* ================= ORDER ================= */

    const { rows: orderRows } = await client.query<DbOrder>(
      `
      SELECT id, seller_id, status
      FROM orders
      WHERE id = $1 AND buyer_id = $2
      LIMIT 1
      `,
      [orderId, buyerId]
    );

    const order = orderRows[0];

    console.log("📦 [RETURN] ORDER:", order);

    if (!order) error("ORDER_NOT_FOUND");

    if (!["completed", "delivered"].includes(order.status)) {
      error("ORDER_NOT_RETURNABLE");
    }

    /* ================= ITEM ================= */

    const { rows: itemRows } = await client.query<DbOrderItem>(
      `
      SELECT
        id,
        product_id,
        variant_id,
        product_name,
        product_slug,
        thumbnail,
        unit_price,
        quantity
      FROM order_items
      WHERE id = $1 AND order_id = $2
      LIMIT 1
      `,
      [orderItemId, orderId]
    );

    const item = itemRows[0];

    console.log("📦 [RETURN] ITEM RAW:", item);

    if (!item) error("ITEM_NOT_FOUND");

    /* ================= DUPLICATE ================= */

    const { rows: existing } = await client.query(
      `
      SELECT 1
      FROM return_items ri
      JOIN returns r ON r.id = ri.return_id
      WHERE ri.order_item_id = $1
        AND r.deleted_at IS NULL
        AND r.status <> 'cancelled'
      LIMIT 1
      `,
      [orderItemId]
    );

    if (existing.length > 0) {
      error("RETURN_EXISTS");
    }

    /* ================= PARSE ================= */

    const unitPrice = toNumberSafe(item.unit_price, "unit_price");
    const quantity = toNumberSafe(item.quantity, "quantity");

    const totalPrice = unitPrice * quantity;
    const refundAmount = totalPrice;

    console.log("🟡 [RETURN][CALC]", {
      unitPrice,
      quantity,
      totalPrice,
      refundAmount,
    });

    /* ================= CREATE RETURN ================= */

    const returnNumber = `RET-${Date.now()}`;

    const { rows: returnRows } = await client.query<{ id: string }>(
      `
      INSERT INTO returns (
        order_id,
        buyer_id,
        seller_id,
        return_number,
        status,
        reason,
        description,
        evidence_images,
        refund_amount
      )
      VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8)
      RETURNING id
      `,
      [
        orderId,
        buyerId,
        order.seller_id,
        returnNumber,
        reason,
        description ?? "",
        images,
        refundAmount,
      ]
    );

    const returnId = returnRows[0].id;

    console.log("🟢 [RETURN] CREATED RETURN:", returnId);

    /* ================= DEBUG PARAM ================= */

    const params = [
      returnId,
      orderItemId,
      item.product_id,
      item.variant_id,
      item.product_name,
      item.product_slug,
      item.thumbnail,
      unitPrice,
      quantity,
      totalPrice,
      quantity,
      refundAmount,
      reason,
    ];

    console.log("🧪 [RETURN] PARAM ARRAY:", params);

    /* ================= INSERT ITEM ================= */

    await client.query(
      `
      INSERT INTO return_items (
        return_id,
        order_item_id,
        product_id,
        variant_id,
        product_name,
        product_slug,
        thumbnail,
        unit_price,
        quantity,
        total_price,
        return_quantity,
        refund_amount,
        reason
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8::numeric,
        $9::integer,
        $10::numeric,
        $11::integer,
        $12::numeric,
        $13
      )
      `,
      params
    );

    console.log("🟢 [RETURN] ITEM INSERTED SUCCESS");

    return returnId;
  });
}

/* =====================================================
   CANCEL RETURN
===================================================== */

export async function cancelReturnByBuyer(
  returnId: string,
  buyerId: string
): Promise<void> {
  if (!isValidUuid(returnId) || !isValidUuid(buyerId)) {
    error("INVALID_INPUT");
  }

  const { rowCount } = await query(
    `
    UPDATE returns
    SET status = 'cancelled',
        cancelled_at = now()
    WHERE id = $1
      AND buyer_id = $2
      AND status = 'pending'
    `,
    [returnId, buyerId]
  );

  if (rowCount === 0) {
    error("RETURN_NOT_CANCELABLE");
  }
}

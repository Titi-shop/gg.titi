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
    SELECT
      r.id,
      r.return_number,
      r.status,
      r.refund_amount,
      r.currency,
      r.created_at,
      ri.product_name,
      ri.thumbnail
    FROM returns r

    JOIN LATERAL (
      SELECT product_name, thumbnail
      FROM return_items
      WHERE return_id = r.id
      LIMIT 1
    ) ri ON true

    WHERE r.buyer_id = $1
      AND r.deleted_at IS NULL

    ORDER BY r.created_at DESC
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

  console.log("🚀 [DB][BUYER RETURN DETAIL]", {
    returnId,
    buyerId,
  });

  /* ================= RETURN ================= */

  const { rows: returnRows } = await query(
    `
    SELECT
      id,
      return_number,
      status,
      reason,
      description,
      evidence_images,
      refund_amount,
      created_at
    FROM returns
    WHERE id = $1
      AND buyer_id = $2
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [returnId, buyerId]
  );

  const ret = returnRows[0];

  if (!ret) return null;

  /* ================= ITEMS ================= */

  const { rows: itemRows } = await query(
    `
    SELECT
      product_name,
      thumbnail,
      quantity,
      unit_price
    FROM return_items
    WHERE return_id = $1
    `,
    [returnId]
  );

  /* ================= FIX IMAGES ================= */

  let evidenceImages: string[] = [];

  if (Array.isArray(ret.evidence_images)) {
    evidenceImages = ret.evidence_images.filter(
      (url) =>
        typeof url === "string" &&
        url.length > 5
    );
  }

  /* ================= MAIN THUMBNAIL ================= */

  const firstItem = itemRows[0];

  /* ================= RESPONSE ================= */

  return {
    id: ret.id,
    return_number: ret.return_number,
    status: ret.status,
    reason: ret.reason,
    description: ret.description,

    refund_amount: Number(ret.refund_amount),
    created_at: ret.created_at,

    // ✅ QUAN TRỌNG
    product_name: firstItem?.product_name ?? "",
    product_thumbnail: firstItem?.thumbnail ?? "",

    // ✅ MULTI IMAGE
    evidence_images: evidenceImages,

    // ✅ FUTURE SCALE
    items: itemRows.map((i) => ({
      product_name: i.product_name,
      thumbnail: i.thumbnail,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
    })),
  };
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
export async function getReturnByIdForSeller(
  returnId: string,
  sellerId: string
) {
  if (!isValidUuid(returnId) || !isValidUuid(sellerId)) {
  throw new Error("INVALID_INPUT");
}

  console.log("🚀 [DB][RETURN DETAIL]", {
    returnId,
    sellerId,
  });

  /* ================= RETURN ================= */

  const { rows: returnRows } = await query(
    `
    SELECT
      id,
      return_number,
      status,
      reason,
      description,
      evidence_images,
      created_at,
      approved_at,
      rejected_at,
      shipped_back_at,
      received_at,
      refunded_at
    FROM returns
    WHERE id = $1
      AND seller_id = $2
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [returnId, sellerId]
  );

  const ret = returnRows[0];

  if (!ret) return null;

  console.log("📦 RETURN RAW:", ret);

  /* ================= ITEMS ================= */

  const { rows: itemRows } = await query(
    `
    SELECT
      product_name,
      thumbnail,
      quantity,
      unit_price
    FROM return_items
    WHERE return_id = $1
    `,
    [returnId]
  );

  console.log("📦 ITEMS RAW:", itemRows);

  /* ================= FIX IMAGE ================= */

  let evidenceImages: string[] = [];

  if (Array.isArray(ret.evidence_images)) {
    evidenceImages = ret.evidence_images.filter(
      (url) =>
        typeof url === "string" &&
        url.startsWith("http")
    );
  }

  console.log("🖼 CLEAN IMAGES:", evidenceImages);

  /* ================= TIMELINE ================= */

  const timeline = [
    {
      key: "created",
      label: "Request created",
      time: ret.created_at,
    },
    ret.approved_at && {
      key: "approved",
      label: "Seller approved",
      time: ret.approved_at,
    },
    ret.rejected_at && {
      key: "rejected",
      label: "Rejected",
      time: ret.rejected_at,
    },
    ret.shipped_back_at && {
      key: "shipping_back",
      label: "Buyer shipped back",
      time: ret.shipped_back_at,
    },
    ret.received_at && {
      key: "received",
      label: "Seller received",
      time: ret.received_at,
    },
    ret.refunded_at && {
      key: "refunded",
      label: "Refund completed",
      time: ret.refunded_at,
    },
  ].filter(Boolean);

  return {
    id: ret.id,
    return_number: ret.return_number,
    status: ret.status,
    reason: ret.reason,
    description: ret.description,

    evidence_images: evidenceImages,

    timeline,

    items: itemRows.map((i) => ({
      product_name: i.product_name,
      thumbnail: i.thumbnail,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
    })),
  };
}
export async function updateReturnStatusBySeller(
  returnId: string,
  sellerId: string,
  action: string
) {
  return withTransaction(async (client) => {

    /* ================= LOCK RETURN ================= */

    const { rows } = await client.query<{
  status: string;
  refund_amount: string;
  order_id: string;
  pi_payment_id: string | null;
  refunded_at: string | null;
}>(
  `
  SELECT
    r.status,
    r.refund_amount,
    r.order_id,
    r.refunded_at,
    o.pi_payment_id
  FROM returns r
  JOIN orders o ON o.id = r.order_id
  WHERE r.id = $1
    AND r.seller_id = $2
  FOR UPDATE
  `,
  [returnId, sellerId]
);

    const ret = rows[0];

    if (!ret) throw new Error("NOT_FOUND");

    let nextStatus = ret.status;

    /* ================= APPROVE ================= */

    if (action === "approve") {
      if (ret.status !== "pending") {
        throw new Error("INVALID_STATE");
      }

      nextStatus = "approved";
    }

    /* ================= REJECT ================= */

    if (action === "received") {
  if (ret.status !== "shipping_back") {
    throw new Error("INVALID_STATE");
  }

  if (ret.refunded_at) {
    throw new Error("ALREADY_REFUNDED");
  }

  const amount = Number(ret.refund_amount);

  if (!amount || amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  /* ================= GET BUYER ================= */

  const { rows: orderRows } = await client.query<{
    buyer_id: string;
  }>(
    `SELECT buyer_id FROM orders WHERE id = $1`,
    [ret.order_id]
  );

  const buyerId = orderRows[0]?.buyer_id;

  if (!buyerId) throw new Error("BUYER_NOT_FOUND");

  /* ================= CREATE WALLET IF NOT EXISTS ================= */

  await client.query(
    `
    INSERT INTO wallets (user_id, balance)
    VALUES ($1, 0)
    ON CONFLICT (user_id) DO NOTHING
    `,
    [buyerId]
  );

  /* ================= UPDATE BALANCE ================= */

  await client.query(
    `
    UPDATE wallets
    SET balance = balance + $1,
        updated_at = now()
    WHERE user_id = $2
    `,
    [amount, buyerId]
  );

  /* ================= LOG TRANSACTION ================= */

  await client.query(
    `
    INSERT INTO wallet_transactions (
      user_id,
      type,
      amount,
      reference_type,
      reference_id
    )
    VALUES ($1, 'credit', $2, 'refund', $3)
    `,
    [buyerId, amount, returnId]
  );

  /* ================= UPDATE RETURN ================= */

  await client.query(
    `
    UPDATE returns
    SET
      status = 'refunded',
      refunded_at = now(),
      received_at = now(),
      updated_at = now()
    WHERE id = $1
    `,
    [returnId]
  );

  console.log("🟢 [REFUND INTERNAL SUCCESS]", {
    returnId,
    buyerId,
    amount,
  });

  return; // 🔥 giữ return ở đây
}

    /* ================= NORMAL UPDATE ================= */

    await client.query(
      `
      UPDATE returns
      SET
        status = $1,
        updated_at = now()
      WHERE id = $2
      `,
      [nextStatus, returnId]
    );

    console.log("🟢 [RETURN UPDATE]", {
      returnId,
      nextStatus,
    });
  });
}
export async function getReturnsBySeller(
  sellerId: string,
  status?: string | null
) {
  console.log("🚀 [DB][SELLER RETURNS]", { sellerId, status });

  const { rows } = await query(
    `
    SELECT
      r.id,
      r.return_number,
      r.status,
      r.created_at,
      ri.product_name,
      ri.thumbnail,
      ri.quantity
    FROM returns r
    JOIN return_items ri ON ri.return_id = r.id
    WHERE r.seller_id = $1
      AND r.deleted_at IS NULL
      AND ($2::text IS NULL OR r.status = $2)
    ORDER BY r.created_at DESC
    `,
    [sellerId, status ?? null]
  );

  return rows;
}
export async function shipReturnByBuyer(params: {
  returnId: string;
  buyerId: string;
  trackingCode: string;
  shippingProvider: string | null;
}): Promise<void> {
  const { returnId, buyerId, trackingCode, shippingProvider } = params;

  if (!returnId || !buyerId) {
    throw new Error("INVALID_INPUT");
  }

  /* ================= CHECK ================= */

  const { rows } = await query<{ status: string }>(
    `
    SELECT status
    FROM returns
    WHERE id = $1
      AND buyer_id = $2
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [returnId, buyerId]
  );
  const item = rows[0];
  if (!item) {
    throw new Error("NOT_FOUND");
  }
  if (item.status !== "approved") {
    throw new Error("INVALID_STATE");
  }
  /* ================= UPDATE ================= */

  await query(
    `
    UPDATE returns
    SET
      status = 'shipping_back',
      return_tracking_code = $1,
      return_shipping_provider = $2,
      shipped_back_at = now(),
      updated_at = now()
    WHERE id = $3
    `,
    [trackingCode, shippingProvider, returnId]
  );

  console.log("🟢 [RETURN][SHIP SUCCESS]", {
    returnId,
  });
}

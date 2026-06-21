import { query, withTransaction } from "@/lib/db";

/* =====================================================
   TYPES
===================================================== */

type DbOrder = {
  id: string;
  seller_id: string;
  fulfillment_status: string;
};

type DbOrderItem = {
  id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  product_slug: string;
  thumbnail: string;
  unit_price: string;
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

function toNumberSafe(
  value: unknown,
  field: string
): number {
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
   RETURN DETAIL
===================================================== */

export async function getReturnByIdForBuyer(
  returnId: string,
  buyerId: string
) {
  if (
    !isValidUuid(returnId) ||
    !isValidUuid(buyerId)
  ) {
    error("INVALID_INPUT");
  }

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

  if (!ret) {
    return null;
  }

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
const { rows: addressRows } = await query(
  `
  SELECT
    sa.recipient_name,
    sa.phone,
    sa.country,
    sa.region,
    sa.district,
    sa.ward,
    sa.address_line,
    sa.postal_code
  FROM returns r
  JOIN seller_addresses sa
    ON sa.id = r.return_address_id
  WHERE r.id = $1
  LIMIT 1
  `,
  [returnId]
);

const sellerAddress =
  addressRows[0] ?? null;
   
  let evidenceImages: string[] = [];

  if (Array.isArray(ret.evidence_images)) {
    evidenceImages = ret.evidence_images.filter(
      (url) =>
        typeof url === "string" &&
        url.length > 5
    );
  }

  const firstItem = itemRows[0];

  return {
  id: ret.id,
  return_number: ret.return_number,
  status: ret.status,
  reason: ret.reason,
  description: ret.description,

  refund_amount: Number(ret.refund_amount),
  created_at: ret.created_at,

  product_name:
    firstItem?.product_name ?? "",

  product_thumbnail:
    firstItem?.thumbnail ?? "",

  evidence_images: evidenceImages,
  seller_address: sellerAddress,

  items: itemRows.map((item) => ({
    product_name: item.product_name,
    thumbnail: item.thumbnail,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
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
    const { rows: orderRows } =
      await client.query<DbOrder>(
        `
        SELECT
          id,
          seller_id,
          fulfillment_status
        FROM orders
        WHERE id = $1
          AND buyer_id = $2
        LIMIT 1
        `,
        [orderId, buyerId]
      );

    const order = orderRows[0];

    if (!order) {
      error("ORDER_NOT_FOUND");
    }

    if (
      !["delivered", "completed"].includes(
        order.fulfillment_status
      )
    ) {
      error("ORDER_NOT_RETURNABLE");
    }

    const { rows: itemRows } =
      await client.query<DbOrderItem>(
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
        WHERE id = $1
          AND order_id = $2
        LIMIT 1
        `,
        [orderItemId, orderId]
      );

    const item = itemRows[0];

    if (!item) {
      error("ITEM_NOT_FOUND");
    }

    const { rows: existing } =
      await client.query(
        `
        SELECT 1
        FROM return_items ri
        JOIN returns r
          ON r.id = ri.return_id
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

    const unitPrice = toNumberSafe(
      item.unit_price,
      "unit_price"
    );

    const quantity = toNumberSafe(
      item.quantity,
      "quantity"
    );

    const totalPrice =
      unitPrice * quantity;

    const refundAmount =
      totalPrice;

    const returnNumber =
      `RET-${Date.now()}`;

    const { rows: returnRows } =
      await client.query<{
        id: string;
      }>(
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
        VALUES (
          $1,$2,$3,$4,
          'pending',
          $5,$6,$7,$8
        )
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

    const returnId =
      returnRows[0].id;

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
      [
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
      ]
    );

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
  if (
    !isValidUuid(returnId) ||
    !isValidUuid(buyerId)
  ) {
    error("INVALID_INPUT");
  }

  const { rowCount } = await query(
    `
    UPDATE returns
    SET
      status = 'cancelled',
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

/* =====================================================
   SHIP RETURN
===================================================== */

export async function shipReturnByBuyer(
  params: {
    returnId: string;
    buyerId: string;
    trackingCode: string;
    shippingProvider: string | null;
  }
): Promise<void> {
  const {
    returnId,
    buyerId,
    trackingCode,
    shippingProvider,
  } = params;

  if (!returnId || !buyerId) {
    throw new Error("INVALID_INPUT");
  }

  const { rows } = await query<{
    status: string;
  }>(
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

  const ret = rows[0];

  if (!ret) {
    throw new Error("NOT_FOUND");
  }

  if (ret.status !== "approved") {
    throw new Error("INVALID_STATE");
  }

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
    [
      trackingCode,
      shippingProvider,
      returnId,
    ]
  );
}

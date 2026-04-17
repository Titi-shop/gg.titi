import { query, withTransaction } from "@/lib/db";

/* =====================================================
   BUYER - GET RETURNS
===================================================== */
export async function getReturnsByBuyer(
  buyerId: string
) {
  const { rows } = await query(
    `
    SELECT
      id,
      return_number,
      status,
      refund_amount,
      currency,
      created_at
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
  return withTransaction(
    async (client) => {
      /* ================= ORDER ================= */
      const {
        rows: orderRows,
      } = await client.query<{
        id: string;
        seller_id: string;
        status: string;
      }>(
        `
        SELECT id, seller_id, status
        FROM orders
        WHERE id = $1
          AND buyer_id = $2
        LIMIT 1
        `,
        [orderId, buyerId]
      );

      const order = orderRows[0];

      if (!order) {
        throw new Error(
          "ORDER_NOT_FOUND"
        );
      }

      if (
        ![
          "completed",
          "delivered",
        ].includes(order.status)
      ) {
        throw new Error(
          "ORDER_NOT_RETURNABLE"
        );
      }

      /* ================= ITEM ================= */
      const {
        rows: itemRows,
      } = await client.query<{
        id: string;
        product_id: string;
        variant_id: string | null;
        product_name: string;
        product_slug: string;
        thumbnail: string;
        unit_price: number;
        quantity: number;
      }>(
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
        throw new Error(
          "ITEM_NOT_FOUND"
        );
      }

      /* ================= DUPLICATE ================= */
      const {
        rows: existing,
      } = await client.query(
        `
        SELECT ri.id
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
        throw new Error(
          "RETURN_EXISTS"
        );
      }

      const refundAmount =
        Number(item.unit_price) *
        Number(item.quantity);

      /* ================= CREATE CASE ================= */
      const returnNumber = `RET-${Date.now()}`;

      const {
        rows: returnRows,
      } = await client.query<{
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
          description,
          images,
          refundAmount,
        ]
      );

      const returnId =
        returnRows[0].id;

      /* ================= ITEM SNAPSHOT ================= */
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
          $8,$9,$10,$11,$12,$13
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
          item.unit_price,
          item.quantity,
          refundAmount,
          item.quantity,
          refundAmount,
          reason,
        ]
      );

      return returnId;
    }
  );
}

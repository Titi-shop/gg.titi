import { query, withTransaction } from "@/lib/db";
import {
  syncOrderFulfillmentStatus,
} from "@/lib/db/orders";

/* =========================================================
   SELLER — ORDER COUNTS
========================================================= */

export async function getSellerOrderCounts(
  sellerId: string
) {
  const { rows } = await query(
    `
    SELECT
      fulfillment_status,
      COUNT(*)::int AS total
    FROM order_items
    WHERE seller_id = $1
    GROUP BY fulfillment_status
    `,
    [sellerId]
  );

  const result = {
    pending: 0,
    processing: 0,
    shipped: 0,
    completed: 0,
    cancelled: 0,
    returned: 0,
  };

  for (const r of rows) {
    const status =
      r.fulfillment_status;

    if (status in result) {
      result[
        status as keyof typeof result
      ] = Number(r.total);
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
  const offset =
    (page - 1) * limit;

  const params: unknown[] = [
    sellerId,
  ];

  let statusFilter = "";
  let limitIndex = 2;
  let offsetIndex = 3;

  if (status) {
    params.push(status);

    statusFilter = `
      AND oi.fulfillment_status = $2
    `;

    limitIndex = 3;
    offsetIndex = 4;
  }

  params.push(limit, offset);

  const { rows } = await query(
    `
    SELECT
      o.id,
      o.order_number,
      o.created_at,

      o.shipping_name,
      o.shipping_phone,
      o.shipping_address_line,
      o.shipping_ward,
      o.shipping_district,
      o.shipping_region,
      o.shipping_country,
      o.shipping_postal_code,

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
            'unit_price', oi.unit_price,
            'quantity', oi.quantity,
            'total_price', oi.total_price,
            'currency', oi.currency,
            'status', oi.fulfillment_status,
            'tracking_code', oi.tracking_code,
            'shipping_provider', oi.shipping_provider,
            'shipped_at', oi.shipped_at,
            'delivered_at', oi.delivered_at,
            'created_at', oi.created_at,
            'snapshot', oi.snapshot
          )
        ) FILTER (
          WHERE oi.id IS NOT NULL
        ),
        '[]'
      ) AS order_items,

      SUM(
        oi.total_price
      )::float AS total

    FROM orders o
    JOIN order_items oi
      ON oi.order_id = o.id

    WHERE oi.seller_id = $1
    ${statusFilter}

    GROUP BY
      o.id,
      o.order_number,
      o.created_at,
      o.shipping_name,
      o.shipping_phone,
      o.shipping_address_line,
      o.shipping_ward,
      o.shipping_district,
      o.shipping_region,
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
      o.fulfillment_status,
      o.payment_status,
      o.created_at,

      o.processing_at,
      o.shipped_at,
      o.delivered_at,
      o.cancelled_at,

      o.shipping_name,
      o.shipping_phone,
      o.shipping_address_line,
      o.shipping_ward,
      o.shipping_district,
      o.shipping_region,
      o.shipping_country,
      o.shipping_postal_code,

      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'thumbnail', oi.thumbnail,
            'variant_name', oi.variant_name,
            'variant_value', oi.variant_value,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price,
            'status', oi.fulfillment_status
          )
        ) FILTER (
          WHERE oi.id IS NOT NULL
        ),
        '[]'
      ) AS order_items,

      SUM(
        oi.total_price
      )::float AS total

    FROM orders o
    JOIN order_items oi
      ON oi.order_id = o.id

    WHERE o.id = $1
      AND oi.seller_id = $2

    GROUP BY
      o.id,
      o.order_number,
      o.fulfillment_status,
      o.payment_status,
      o.created_at,
      o.processing_at,
      o.shipped_at,
      o.delivered_at,
      o.cancelled_at,
      o.shipping_name,
      o.shipping_phone,
      o.shipping_address_line,
      o.shipping_ward,
      o.shipping_district,
      o.shipping_region,
      o.shipping_country,
      o.shipping_postal_code
    `,
    [orderId, sellerId]
  );

  return rows[0] ?? null;
}

/* =========================================================
   SELLER — START SHIPPING
========================================================= */

export async function startShippingBySeller(
  orderId: string,
  sellerId: string
): Promise<boolean> {

  try {

    return await withTransaction(
      async (client) => {

        /* =====================================================
           1. UPDATE ORDER ITEMS → SHIPPED

           FLOW:
           processing → shipped
        ===================================================== */

        const res =
          await client.query(
            `
            UPDATE order_items

            SET
              fulfillment_status = 'shipped',

              shipped_at = NOW(),

              updated_at = NOW()

            WHERE order_id = $1
              AND seller_id = $2
              AND fulfillment_status = 'processing'
            `,
            [
              orderId,
              sellerId,
            ]
          );

        if (
          res.rowCount === 0
        ) {

          console.warn(
            "[ORDER][SELLER][SHIP][NO_ITEMS]",
            {
              orderId,
              sellerId,
            }
          );

          return false;
        }

        /* =====================================================
           2. UPDATE MAIN ORDER

           IMPORTANT:
           buyer app reads:
           orders.fulfillment_status
        ===================================================== */

        await client.query(
          `
          UPDATE orders

          SET
            fulfillment_status = 'shipped',
            shipped_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
            AND fulfillment_status IN (
              'pending',
              'processing'
            )
          `,
          [orderId]
        );

        /* =====================================================
           3. SET AUTO RELEASE TIMER

           IMPORTANT:
           - NO payout here
           - NO wallet update here
           - only schedule release timing

           FLOW:
           shipped
           → wait 10 hours
           → cron auto complete
        ===================================================== */

        const escrowUpdate =
  await client.query(
    `
    UPDATE escrow_entries

    SET
      release_after =
        NOW() + interval '1 hours',

      updated_at = NOW()

    WHERE order_id = $1
      AND seller_id = $2

    RETURNING
      id,
      status,
      release_status,
      release_after
    `,
    [
      orderId,
      sellerId,
    ]
  );

console.log(
  "[ORDER][SELLER][SHIP][ESCROW_TIMER]",
  {
    rowCount:
      escrowUpdate.rowCount,

    rows:
      escrowUpdate.rows,
  }
);

        /* =====================================================
           4. GLOBAL STATUS SYNC
        ===================================================== */

        await syncOrderFulfillmentStatus(
          client,
          orderId
        );

        console.log(
          "[ORDER][SELLER][SHIP][SUCCESS]",
          {
            orderId,
            sellerId,
          }
        );

        return true;
      }
    );

  } catch (err) {

    console.error(
      "[ORDER][SELLER][SHIP][DB_ERROR]",
      {
        message:
          err instanceof Error
            ? err.message
            : "UNKNOWN",
      }
    );

    throw new Error(
      "DB_ERROR"
    );
  }
}
/* =========================================================
   SELLER — CANCEL ORDER
========================================================= */

export async function cancelOrderBySeller(
  orderId: string,
  sellerId: string,
  reason: string | null
): Promise<boolean> {
  try {
    return await withTransaction(
      async (client) => {
        const res =
          await client.query(
            `
            UPDATE order_items
            SET
              fulfillment_status = 'cancelled',
              seller_cancel_reason = COALESCE(
                $3,
                seller_cancel_reason
              ),
              updated_at = NOW()
            WHERE order_id = $1
              AND seller_id = $2
              AND fulfillment_status IN (
                'pending',
                'processing'
              )
            `,
            [
              orderId,
              sellerId,
              reason,
            ]
          );

        if (
          res.rowCount === 0
        ) {
          console.warn(
            "[ORDER][SELLER][CANCEL][NO_ITEMS]",
            {
              orderId,
            }
          );

          return false;
        }

        await syncOrderFulfillmentStatus(
          client,
          orderId
        );

        console.log(
          "[ORDER][SELLER][CANCEL][SUCCESS]",
          { orderId }
        );

        return true;
      }
    );
  } catch (err) {
    console.error(
      "[ORDER][SELLER][CANCEL][DB_ERROR]",
      {
        message:
          err instanceof Error
            ? err.message
            : "UNKNOWN",
      }
    );

    throw new Error(
      "DB_ERROR"
    );
  }
}

/* =========================================================
   SELLER — CONFIRM ORDER
========================================================= */
  
            export async function confirmOrderBySeller(
  orderId: string,
  sellerId: string,
  sellerMessage?: string | null
): Promise<boolean> {
  try {
    return await withTransaction(async (client) => {

      /* =========================
         1. GET ORDER (ONLY CHECK)
      ========================= */
      const { rows } = await client.query<{
        seller_id: string;
        fulfillment_status: string;
      }>(
        `
        SELECT
          seller_id,
          fulfillment_status
        FROM orders
        WHERE id = $1
        LIMIT 1
        `,
        [orderId]
      );

      const order = rows[0];

      if (!order) {
        console.warn("[ORDER][SELLER][CONFIRM][NOT_FOUND]", {
          orderId,
        });
        return false;
      }

      if (order.seller_id !== sellerId) {
        console.warn("[ORDER][SELLER][CONFIRM][FORBIDDEN]", {
          orderId,
          sellerId,
        });
        return false;
      }

      /* =========================
         2. CHECK ORDER STATE
      ========================= */
      if (order.fulfillment_status !== "pending_fulfillment") {
        console.warn("[ORDER][SELLER][CONFIRM][INVALID_STATUS]", {
          orderId,
          status: order.fulfillment_status,
        });
        return false;
      }

      /* =========================
         3. UPDATE ORDER ITEMS
         (FIXED HERE 🔥)
      ========================= */
      const res = await client.query(
        `
        UPDATE order_items
        SET
          fulfillment_status = 'processing',
          confirmed_at = NOW(),
          processing_at = NOW(),
          seller_message = COALESCE($3, seller_message),
          updated_at = NOW()
        WHERE order_id = $1
          AND seller_id = $2
          AND fulfillment_status = 'pending'
        `,
        [
          orderId,
          sellerId,
          sellerMessage ?? "",
        ]
      );

      if (res.rowCount === 0) {
        console.warn("[ORDER][SELLER][CONFIRM][NO_ITEMS]", {
          orderId,
          sellerId,
        });
        return false;
      }

      /* =========================
         4. SYNC ORDER STATUS
      ========================= */
      await syncOrderFulfillmentStatus(client, orderId);

      console.log("[ORDER][SELLER][CONFIRM][SUCCESS]", {
        orderId,
      });

      return true;
    });

  } catch (err) {
    console.error("[ORDER][SELLER][CONFIRM][DB_ERROR]", {
      message: err instanceof Error ? err.message : "UNKNOWN",
    });

    throw new Error("DB_ERROR");
  }
            }

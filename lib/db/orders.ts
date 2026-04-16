import type { PoolClient } from "pg";

/* =========================================================
   EXPORT MODULES (BARREL)
========================================================= */
export * from "./orders.payment";
export * from "./orders.preview";
export * from "./orders.seller";
export * from "./orders.buyer";
export * from "./orders.return";
export * from "./orders.create";

/* =========================================================
   CORE — SYNC ORDER STATUS (SOURCE OF TRUTH)
========================================================= */
type OrderStatRow = {
  pending: number;
  confirmed: number;
  shipping: number;
  completed: number;
  cancelled: number;
  total: number;
};

export async function syncOrderStatus(
  client: PoolClient,
  orderId: string
): Promise<void> {
  /* ================= VALIDATE ================= */
  if (!orderId || typeof orderId !== "string") {
    throw new Error("INVALID_ORDER_ID");
  }

  try {
    /* ================= CALCULATE ================= */
    const { rows } = await client.query<OrderStatRow>(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
        COUNT(*) FILTER (WHERE status = 'shipping')::int AS shipping,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
        COUNT(*)::int AS total
      FROM order_items
      WHERE order_id = $1
      `,
      [orderId]
    );

    const stat = rows[0];

    if (!stat || stat.total === 0) {
      console.warn("[ORDER][SYNC][EMPTY]", { orderId });
      return;
    }

    /* ================= DETERMINE STATUS ================= */
    let nextStatus: string = "pending";

    /**
     * PRIORITY (RẤT QUAN TRỌNG)
     * completed > cancelled > shipping > confirmed > pending
     */
    if (stat.completed === stat.total) {
      nextStatus = "completed";
    } else if (stat.cancelled === stat.total) {
      nextStatus = "cancelled";
    } else if (stat.shipping > 0) {
      nextStatus = "shipping";
    } else if (stat.confirmed > 0) {
      nextStatus = "confirmed";
    } else {
      nextStatus = "pending";
    }

    /* ================= UPDATE ORDER ================= */
    await client.query(
      `
      UPDATE orders
      SET
        status = $2,
        updated_at = NOW(),

        confirmed_at = CASE 
          WHEN $2 = 'confirmed' AND confirmed_at IS NULL 
          THEN NOW() ELSE confirmed_at END,

        shipped_at = CASE 
          WHEN $2 = 'shipping' AND shipped_at IS NULL 
          THEN NOW() ELSE shipped_at END,

        delivered_at = CASE 
          WHEN $2 = 'completed' AND delivered_at IS NULL 
          THEN NOW() ELSE delivered_at END,

        cancelled_at = CASE 
          WHEN $2 = 'cancelled' AND cancelled_at IS NULL 
          THEN NOW() ELSE cancelled_at END

      WHERE id = $1
        AND status <> $2
      `,
      [orderId, nextStatus]
    );

    /* ================= LOG ================= */
    console.log("[ORDER][SYNC][DONE]", {
      orderId,
      nextStatus,
      stat,
    });

  } catch (err) {
    console.error("[ORDER][SYNC][DB_ERROR]", {
      orderId,
      message: err instanceof Error ? err.message : "UNKNOWN",
    });

    throw new Error("DB_ERROR");
  }
}

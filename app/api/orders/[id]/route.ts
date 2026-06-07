import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";

/* ✅ BARREL IMPORT */
import { getOrderByBuyerId } from "@/lib/db/orders.buyer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =====================================================
   VALIDATE
===================================================== */
function isValidId(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/* =====================================================
   GET ORDER DETAIL
===================================================== */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const startedAt = Date.now();

  try {
    /* =====================================================
       REQUEST START
    ===================================================== */
    console.log("[ORDER][DETAIL][REQUEST_START]", {
      method: req.method,
      url: req.url,
      orderId: params?.id ?? null,
      timestamp: new Date().toISOString(),
    });

    /* =====================================================
       AUTH
    ===================================================== */
    console.log("[ORDER][DETAIL][AUTH][START]");

    const auth = await requireAuth();

    if (!auth.ok) {
      console.warn("[ORDER][DETAIL][AUTH][FAILED]", {
        orderId: params?.id ?? null,
      });

      return auth.response;
    }

    const userId = auth.userId;

    console.log("[ORDER][DETAIL][AUTH][SUCCESS]", {
      userId,
    });

    /* =====================================================
       PARAM
    ===================================================== */
    const orderId = params?.id;

    console.log("[ORDER][DETAIL][PARAMS]", {
      orderId,
      type: typeof orderId,
    });

    if (!isValidId(orderId)) {
      console.warn("[ORDER][DETAIL][INVALID_ORDER_ID]", {
        received: orderId,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_ORDER_ID",
        },
        { status: 400 }
      );
    }

    /* =====================================================
       DB QUERY START
    ===================================================== */
    console.log("[ORDER][DETAIL][DB][QUERY_START]", {
      orderId,
      userId,
    });

    const order = await getOrderByBuyerId(orderId, userId);

    console.log("[ORDER][DETAIL][DB][QUERY_FINISHED]", {
      orderFound: !!order,
      orderId,
    });

    /* =====================================================
       NOT FOUND
    ===================================================== */
    if (!order) {
      console.warn("[ORDER][DETAIL][NOT_FOUND]", {
        orderId,
        userId,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "ORDER_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    /* =====================================================
       SUCCESS LOG
    ===================================================== */
    console.log("[ORDER][DETAIL][SUCCESS]", {
      orderId: order.id,
      userId,
      orderNumber: order.order_number ?? null,
      status: order.fulfillment_status ?? null,
      settlementStatus: order.settlement_status ?? null,
      paymentStatus: order.payment_status ?? null,
      currency: order.currency ?? null,
      total: order.total ?? null,
      itemsCount: Array.isArray(order.order_items)
        ? order.order_items.length
        : 0,
      durationMs: Date.now() - startedAt,
    });

    /* =====================================================
       RESPONSE
    ===================================================== */
    return NextResponse.json({
  ok: true,
  order: {
    ...order,
    order_items: Array.isArray(order.order_items)
      ? order.order_items
      : [],
  },
});

  } catch (err) {
    /* =====================================================
       ERROR
    ===================================================== */
    console.error("[ORDER][DETAIL][ERROR]", {
      message: err instanceof Error ? err.message : "UNKNOWN_ERROR",
      stack: err instanceof Error ? err.stack : undefined,
      orderId: params?.id ?? null,
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        ok: false,
        error: "SERVER_ERROR",
      },
      { status: 500 }
    );
  } finally {
    /* =====================================================
       REQUEST END
    ===================================================== */
    console.log("[ORDER][DETAIL][REQUEST_END]", {
      orderId: params?.id ?? null,
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  }
}

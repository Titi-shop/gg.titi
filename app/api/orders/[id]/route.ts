import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";

/* ✅ BARREL IMPORT */
import { getOrderByBuyerId } from "@/lib/db/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ================= VALIDATE ================= */
function isValidId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    /* ================= AUTH ================= */
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    console.log("[ORDER][DETAIL][START]", {
      userId,
      orderId: params?.id,
    });

    /* ================= PARAM ================= */
    const orderId = params?.id;

    if (!isValidId(orderId)) {
      console.warn("[ORDER][DETAIL][INVALID_ID]", {
        orderId,
      });

      return NextResponse.json(
        { error: "INVALID_ORDER_ID" },
        { status: 400 }
      );
    }

    /* ================= DB ================= */
    const order = await getOrderByBuyerId(orderId, userId);

    /* ================= NOT FOUND ================= */
    if (!order) {
      console.warn("[ORDER][DETAIL][NOT_FOUND]", {
        orderId,
        userId,
      });

      return NextResponse.json(
        { error: "ORDER_NOT_FOUND" },
        { status: 404 }
      );
    }

    /* ================= SUCCESS ================= */
    console.log("[ORDER][DETAIL][SUCCESS]", {
      orderId,
      items: order?.order_items?.length ?? 0,
    });

    return NextResponse.json(order);

  } catch (err) {
    console.error("[ORDER][DETAIL][ERROR]", {
      message: err instanceof Error ? err.message : "UNKNOWN",
    });

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

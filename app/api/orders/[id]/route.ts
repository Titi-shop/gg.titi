import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { getOrderByBuyerId } from "@/lib/db/orders.buyer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

export async function GET(
  req: Request,
  context: { params: { id: string } }
) {
  try {
    /* ================= AUTH ================= */
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* ================= PARAMS ================= */
    const orderId = context?.params?.id;

    /* ================= VALIDATION ================= */
    if (!isValidId(orderId)) {
      return NextResponse.json(
        { error: "INVALID_ORDER_ID" },
        { status: 400 }
      );
    }

    /* ================= DB ================= */
    const order = await getOrderByBuyerId(orderId, userId);

    if (!order) {
      return NextResponse.json(
        { error: "ORDER_NOT_FOUND" },
        { status: 404 }
      );
    }

    /* ================= RESPONSE ================= */
    return NextResponse.json(order);

  } catch (err) {
    console.error("[ORDER] GET_ORDER_BY_ID_ERROR", err);

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

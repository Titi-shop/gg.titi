import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";

/* ✅ IMPORT TỪ BARREL */
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

    /* ================= PARAM ================= */
    const orderId = params?.id;

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

    return NextResponse.json(order);

  } catch (err) {
    console.error("[ORDER] GET_ORDER_BY_ID_ERROR", err);

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

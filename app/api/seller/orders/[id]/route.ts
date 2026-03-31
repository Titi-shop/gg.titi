import { NextRequest, NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { getSellerOrderById } from "@/lib/db/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    /* ================= AUTH ================= */
    const auth = await requireSeller();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* ================= VALIDATION ================= */
    const orderId = params?.id;

    if (!isValidId(orderId)) {
      return NextResponse.json(
        { error: "INVALID_ORDER_ID" },
        { status: 400 }
      );
    }

    /* ================= DB ================= */
    const order = await getSellerOrderById(orderId, userId);

    if (!order) {
      return NextResponse.json(
        { error: "ORDER_NOT_FOUND" },
        { status: 404 }
      );
    }

    /* ================= RESPONSE ================= */
    return NextResponse.json(order);

  } catch {
    console.error("[SELLER][ORDER] GET_ORDER_BY_ID_ERROR");

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

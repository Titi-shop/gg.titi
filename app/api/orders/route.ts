import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { getOrdersByBuyer } from "@/lib/db/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    /* ================= AUTH ================= */
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* ================= DB ================= */
    const orders = await getOrdersByBuyer(userId);

    return NextResponse.json({ orders });

  } catch {
    console.error("[ORDER] GET_ORDERS_ERROR");

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

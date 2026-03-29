import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { getOrdersByBuyer } from "@/lib/db/orders";

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

  } catch (err) {
    console.error("ORDERS API ERROR:", err);

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

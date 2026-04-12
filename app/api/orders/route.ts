import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

import {
  getOrdersByBuyer,
  getBuyerOrderCounts,
} from "@/lib/db/orders.buyer";

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

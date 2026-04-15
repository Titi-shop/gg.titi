import { NextResponse, NextRequest } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

/* ✅ IMPORT ĐÚNG */
import { getOrdersByBuyer } from "@/lib/db/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    /* ================= AUTH ================= */
    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    /* ================= DB ================= */
    const orders = await getOrdersByBuyer(userId);

    return NextResponse.json({ orders });

  } catch (err) {
    console.error("[ORDER] GET_ORDERS_ERROR", err);

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

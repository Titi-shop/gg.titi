import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { getBuyerOrderCounts } from "@/lib/db/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    /* ================= AUTH ================= */
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* ================= DB ================= */
    const counts = await getBuyerOrderCounts(userId);

    return NextResponse.json(counts);

  } catch (err) {
    console.error("ORDER COUNT ERROR:", err);

    return NextResponse.json(
      {
        pending: 0,
        pickup: 0,
        shipping: 0,
        completed: 0,
        cancelled: 0
      },
      { status: 200 }
    );
  }
}

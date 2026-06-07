import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { getSellerOrderCounts } from "@/lib/db/orders.seller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    /* ================= AUTH ================= */
    const auth = await requireSeller();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* ================= DB ================= */
    const counts = await getSellerOrderCounts(userId);

    /* ================= RESPONSE ================= */
    return NextResponse.json(counts);

  } catch (err) {
    console.error("SELLER ORDER COUNT ERROR:", err);

    return NextResponse.json(
      {
        pending: 0,
        processing: 0,
        shipped : 0,
        delivered:0,
        completed: 0,
        returned: 0,
        cancelled: 0,
      },
      { status: 500 }
    );
  }
}

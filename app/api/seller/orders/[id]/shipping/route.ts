import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { startShippingBySeller } from "@/lib/db/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    /* ================= AUTH ================= */
    const auth = await requireSeller();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;
    const orderId = params.id;

    if (!orderId) {
      return NextResponse.json(
        { error: "MISSING_ORDER_ID" },
        { status: 400 }
      );
    }

    /* ================= DB ================= */
    const updated = await startShippingBySeller(
      orderId,
      userId
    );

    if (!updated) {
      return NextResponse.json(
        { error: "NOTHING_UPDATED" },
        { status: 400 }
      );
    }

    /* ================= DONE ================= */
    return NextResponse.json({
      success: true,
      message: "ORDER_ITEMS_SHIPPING"
    });

  } catch (err) {
    console.error("❌ SHIPPING ERROR:", err);

    return NextResponse.json(
      { error: "FAILED" },
      { status: 500 }
    );
  }
}

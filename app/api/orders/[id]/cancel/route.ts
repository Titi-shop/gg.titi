import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { cancelOrderByBuyer } from "@/lib/db/orders";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    /* ================= AUTH ================= */
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;
    const orderId = params.id;

    if (!orderId) {
      return NextResponse.json(
        { error: "INVALID_ORDER_ID" },
        { status: 400 }
      );
    }

    /* ================= BODY ================= */
    const body = await req.json().catch(() => ({}));

    const reason =
      typeof body.cancel_reason === "string"
        ? body.cancel_reason.trim()
        : "buyer_cancelled";

    /* ================= DB ================= */
    const result = await cancelOrderByBuyer(
      orderId,
      userId,
      reason
    );

    if (result === "NOT_FOUND") {
      return NextResponse.json(
        { error: "ORDER_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (result === "FORBIDDEN") {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    if (result === "INVALID_STATUS") {
      return NextResponse.json(
        { error: "ORDER_CANNOT_BE_CANCELLED" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
    });

  } catch (err) {
    console.error("ORDER CANCEL ERROR:", err);

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

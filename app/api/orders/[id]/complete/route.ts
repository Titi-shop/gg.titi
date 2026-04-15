import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { completeOrderByBuyer } from "@/lib/db/orders.buyer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    /* ================= AUTH ================= */
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* ================= PARAMS ================= */
    const orderId = context?.params?.id;

    if (!isValidId(orderId)) {
      console.warn("[ORDER][COMPLETE][INVALID_ID]", { orderId });

      return NextResponse.json(
        { error: "INVALID_ORDER_ID" },
        { status: 400 }
      );
    }

    /* ================= DB ================= */
    const result = await completeOrderByBuyer(orderId, userId);

if (result === "NOT_FOUND") {
  return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
}

if (result === "FORBIDDEN") {
  return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
}

if (result === "INVALID_STATUS") {
  return NextResponse.json(
    { error: "ORDER_CANNOT_COMPLETE" },
    { status: 400 }
  );
}

    /* ================= SUCCESS ================= */
    console.log("[ORDER][COMPLETE][SUCCESS]", {
      orderId,
    });

    return NextResponse.json({
      success: true,
      message: "ORDER_COMPLETED",
    });

  } catch (err) {
    console.error("[ORDER][COMPLETE][ERROR]", {
      message: err instanceof Error ? err.message : "UNKNOWN",
    });

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

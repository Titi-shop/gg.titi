import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { cancelOrderBySeller } from "@/lib/db/orders.seller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidId(v: unknown): v is string {
  return typeof v === "string" && v.length > 10;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireSeller();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;
    const orderId = params?.id;

    if (!isValidId(orderId)) {
      console.warn("[ORDER][SELLER][CANCEL][INVALID_ID]", { orderId });
      return NextResponse.json({ error: "INVALID_ORDER_ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    const cancelReason =
      typeof body?.cancel_reason === "string"
        ? body.cancel_reason.trim()
        : null;

    console.log("[ORDER][SELLER][CANCEL][INPUT]", {
      orderId,
      userId,
      cancelReason,
    });

    const updated = await cancelOrderBySeller(
      orderId,
      userId,
      cancelReason
    );

    if (!updated) {
      return NextResponse.json(
        { error: "NOTHING_UPDATED" },
        { status: 400 }
      );
    }

    console.log("[ORDER][SELLER][CANCEL][SUCCESS]", { orderId });

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("[ORDER][SELLER][CANCEL][ERROR]", {
      message: err instanceof Error ? err.message : "UNKNOWN",
    });

    return NextResponse.json({ error: "FAILED" }, { status: 500 });
  }
}

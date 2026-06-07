import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { confirmOrderBySeller } from "@/lib/db/orders.seller";

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
      return NextResponse.json(
        { error: "INVALID_ORDER_ID" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const sellerMessage =
      typeof body?.seller_message === "string"
        ? body.seller_message.trim()
        : null;

    console.log("[ORDER][SELLER][CONFIRM][INPUT]", {
      orderId,
      userId,
    });

    const success = await confirmOrderBySeller(
      orderId,
      userId,
      sellerMessage
    );

    if (!success) {
      return NextResponse.json(
        { error: "NOTHING_TO_CONFIRM" },
        { status: 400 }
      );
    }

    console.log("[ORDER][SELLER][CONFIRM][SUCCESS]", { orderId });

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("[ORDER][SELLER][CONFIRM][ERROR]", {
      message: err instanceof Error ? err.message : "UNKNOWN",
    });

    return NextResponse.json({ error: "FAILED" }, { status: 500 });
  }
}

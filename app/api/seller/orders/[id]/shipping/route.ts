import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { startShippingBySeller } from "@/lib/db/orders";

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

    console.log("[ORDER][SELLER][SHIP][INPUT]", {
      orderId,
      userId,
    });

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

    console.log("[ORDER][SELLER][SHIP][SUCCESS]", { orderId });

    return NextResponse.json({
      success: true,
      message: "ORDER_ITEMS_SHIPPING"
    });

  } catch (err) {
    console.error("[ORDER][SELLER][SHIP][ERROR]", {
      message: err instanceof Error ? err.message : "UNKNOWN",
    });

    return NextResponse.json({ error: "FAILED" }, { status: 500 });
  }
}

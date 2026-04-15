import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { confirmOrderBySeller } from "@/lib/db/orders.seller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  seller_message?: string;
};

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

    /* ================= BODY ================= */
    let body: Body = {};
    try {
      body = (await req.json()) as Body;
    } catch {}

    const sellerMessage =
      typeof body.seller_message === "string"
        ? body.seller_message.trim()
        : null;

    /* ================= DB ================= */
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

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("CONFIRM ORDER ERROR", err);

    return NextResponse.json(
      { error: "FAILED" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { previewOrder } from "@/lib/db/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ================= TYPES ================= */

type Body = {
  product_id?: unknown;
  quantity?: unknown;
};

/* ================= SAFE ================= */

function safeQuantity(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n)) return 1;
  if (n < 1) return 1;
  if (n > 10) return 10;
  return n;
}

/* ================= POST ================= */

export async function POST(req: NextRequest) {
  try {
    /* ================= AUTH ================= */
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* ================= BODY ================= */
    const raw = await req.json().catch(() => null);

    if (!raw || typeof raw !== "object") {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const body = raw as Body;

    const productId =
      typeof body.product_id === "string"
        ? body.product_id
        : "";

    const quantity = safeQuantity(body.quantity);

    if (!productId) {
      return NextResponse.json(
        { error: "INVALID_PRODUCT_ID" },
        { status: 400 }
      );
    }

    /* ================= DB ================= */
    const result = await previewOrder(userId, {
      productId,
      quantity,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });

  } catch (err) {
    console.error("[ORDER PREVIEW]", err);

    const message =
      err instanceof Error ? err.message : "SERVER_ERROR";

    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}

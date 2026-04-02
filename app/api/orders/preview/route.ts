import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { previewOrder } from "@/lib/db/orders";

export const runtime = "nodejs";

/* =========================
   TYPES
========================= */

type PreviewBody = {
  country?: string;
  items?: {
    product_id: string;
    quantity: number;
  }[];
};

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    value.toLowerCase()
  );
}
/* =========================
   POST
========================= */

export async function POST(req: NextRequest) {
  try {
    /* ================= AUTH ================= */

    const auth = await requireAuth();

    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* ================= BODY ================= */

    const body = (await req.json()) as PreviewBody;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const { country, items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "INVALID_ITEMS" },
        { status: 400 }
      );
    }

    /* ================= VALIDATE ITEMS ================= */

    const cleanItems = items.filter(
  (i) =>
    i &&
    typeof i.product_id === "string" &&
    isUUID(i.product_id) && 
    typeof i.quantity === "number" &&
    i.quantity > 0
);

    if (cleanItems.length === 0) {
      return NextResponse.json(
        { error: "INVALID_ITEMS" },
        { status: 400 }
      );
    }

    /* ================= CALL DB ================= */

    const result = await previewOrder({
      userId,
      country: typeof country === "string" ? country : undefined,
      items: cleanItems,
    });

    /* ================= RESPONSE ================= */

    return NextResponse.json(result);
  } catch (err) {
    console.error("[ORDER][PREVIEW] ERROR", err);

    return NextResponse.json(
      { error: "PREVIEW_FAILED" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { previewOrder } from "@/lib/db/orders";

export const runtime = "nodejs";

/* ================= TYPES ================= */

type PreviewItem = {
  product_id: string;
  quantity: number;
};

type PreviewBody = {
  country?: string;
  selectedRegion?: string;
  items?: PreviewItem[];
};

/* ================= UTILS ================= */

function isUUID(value: string): boolean {
  if (typeof value !== "string") return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

/* ================= API ================= */

export async function POST(req: NextRequest) {
  try {
    console.log("🟡 [ORDER][PREVIEW] START");

    /* ================= AUTH ================= */

    const auth = await requireAuth();

    if (!auth.ok) {
      console.log("🔴 AUTH FAILED");
      return auth.response;
    }

    const userId = auth.userId;
    console.log("🟢 USER:", userId);

    /* ================= BODY ================= */

    const body = (await req.json().catch(() => null)) as PreviewBody | null;

    console.log("🟡 BODY:", body);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const { country, items } = body;

    if (!country || typeof country !== "string") {
      const selectedRegion =
  typeof body.selectedRegion === "string"
    ? body.selectedRegion
    : "";

if (!selectedRegion) {
  return NextResponse.json(
    { error: "MISSING_REGION" },
    { status: 400 }
  );
}
      console.log("🔴 INVALID COUNTRY");
      return NextResponse.json(
        { error: "INVALID_COUNTRY" },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      console.log("🔴 INVALID ITEMS EMPTY");
      return NextResponse.json(
        { error: "INVALID_ITEMS" },
        { status: 400 }
      );

    /* ================= VALIDATE ITEMS ================= */

    const cleanItems: PreviewItem[] = [];

    for (const item of items) {
      if (!item || typeof item !== "object") continue;

      const productId =
        typeof item.product_id === "string"
          ? item.product_id.trim()
          : "";

      const quantity =
        typeof item.quantity === "number" &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0
          ? item.quantity
          : 0;

      if (!productId || !isUUID(productId)) {
        console.log("🔴 INVALID PRODUCT ID:", productId);
        continue;
      }

      if (quantity <= 0) {
        console.log("🔴 INVALID QUANTITY:", quantity);
        continue;
      }

      cleanItems.push({
        product_id: productId,
        quantity,
      });
    }

    console.log("🟢 CLEAN ITEMS:", cleanItems);

    if (cleanItems.length === 0) {
      return NextResponse.json(
        { error: "INVALID_ITEMS" },
        { status: 400 }
      );
    }

    /* ================= CALL DB ================= */

    console.log("🟡 CALL previewOrder");

    const result = await previewOrder({
  userId,
  country,
  selectedRegion,
  items: cleanItems,
});

    console.log("🟢 PREVIEW RESULT:", result);

    /* ================= RESPONSE ================= */

    return NextResponse.json(result);
  } catch (err) {
    console.error("🔥 [ORDER][PREVIEW] ERROR", err);

    return NextResponse.json(
      { error: "PREVIEW_FAILED" },
      { status: 500 }
    );
  }
}

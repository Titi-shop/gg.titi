import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { previewOrder } from "@/lib/db/orders";

export const runtime = "nodejs";

/* =========================================================
   TYPES
========================================================= */

type PreviewItem = {
  product_id: string;
  quantity: number;
};

type PreviewBody = {
  country?: string;
  items?: PreviewItem[];
};

/*=========================================================
   HELPERS
========================================================= */

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    value.toLowerCase()
  );
}

/* =========================================================
   POST
========================================================= */

export async function POST(req: NextRequest) {
  try {
    console.log("🟡 [ORDER][PREVIEW] START");

    /* ================= AUTH ================= */

    const auth = await requireAuth();

    if (!auth.ok) {
      console.log("🔴 [ORDER][PREVIEW] AUTH FAILED");
      return auth.response;
    }

    const userId = auth.userId;

    console.log("🟢 [ORDER][PREVIEW] USER OK", { userId });

    /* ================= BODY ================= */

    const raw = await req.json().catch(() => null);

    if (!raw || typeof raw !== "object") {
      console.log("🔴 INVALID BODY");
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const body = raw as PreviewBody;

    const country =
      typeof body.country === "string" ? body.country : undefined;

    const items = Array.isArray(body.items) ? body.items : [];

    console.log("🟡 [ORDER][PREVIEW] BODY", {
      country,
      itemsCount: items.length,
    });

    if (items.length === 0) {
      console.log("🔴 EMPTY ITEMS");
      return NextResponse.json(
        { error: "INVALID_ITEMS" },
        { status: 400 }
      );
    }

    /* ================= VALIDATE ITEMS ================= */

    const cleanItems: PreviewItem[] = [];

    for (const i of items) {
      if (!i || typeof i !== "object") continue;

      if (typeof i.product_id !== "string") {
        console.log("🔴 INVALID PRODUCT_ID TYPE", i);
        continue;
      }

      if (!isUUID(i.product_id)) {
        console.log("🔴 INVALID UUID", i.product_id);
        continue;
      }

      if (
        typeof i.quantity !== "number" ||
        !Number.isInteger(i.quantity) ||
        i.quantity <= 0
      ) {
        console.log("🔴 INVALID QUANTITY", i);
        continue;
      }

      cleanItems.push({
        product_id: i.product_id,
        quantity: i.quantity,
      });
    }

    console.log("🟢 CLEAN ITEMS", {
      valid: cleanItems.length,
      invalid: items.length - cleanItems.length,
    });

    if (cleanItems.length === 0) {
      console.log("🔴 ALL ITEMS INVALID");
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
      items: cleanItems,
    });

    console.log("🟢 PREVIEW SUCCESS", {
      total: result?.total,
    });

    /* ================= RESPONSE ================= */

    return NextResponse.json(result);

  } catch (err) {
    console.error("🔥 [ORDER][PREVIEW] ERROR", err);

    return NextResponse.json(
      { error: "PREVIEW_FAILED" },
      { status: 500 }
    );
  }

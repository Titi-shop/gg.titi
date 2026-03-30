import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import {
  getCartByBuyer,
  upsertCartItems,
} from "@/lib/db/orders";

/* ================= GET CART ================= */

export async function GET() {
  try {
    console.log("🟡 [CART GET] START");

    /* ================= AUTH ================= */
    const auth = await requireAuth();

    if (!auth.ok) {
      console.log("🔴 [CART GET] UNAUTHORIZED");
      return auth.response;
    }

    const userId = auth.userId;
    console.log("🟢 [CART GET] USER:", userId);

    /* ================= DB ================= */
    const items = await getCartByBuyer(userId);

    console.log("🟢 [CART GET] ITEMS:", items.length);

    return NextResponse.json(items);

  } catch (err) {
    console.error("❌ [CART GET ERROR]:", err);
    return NextResponse.json([], { status: 500 });
  }
}

/* ================= ADD / UPDATE CART ================= */

export async function POST(req: NextRequest) {
  try {
    console.log("🟡 [CART POST] START");

    /* ================= AUTH ================= */
    const auth = await requireAuth();

    if (!auth.ok) {
      console.log("🔴 [CART POST] UNAUTHORIZED");
      return auth.response;
    }

    const userId = auth.userId;
    console.log("🟢 [CART POST] USER:", userId);

    /* ================= BODY ================= */
    let body: unknown;

    try {
      body = await req.json();
    } catch (e) {
      console.error("❌ [CART POST] INVALID JSON:", e);
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    console.log("🟡 [CART POST] RAW BODY:", body);

    const items = Array.isArray(body) ? body : [body];

    console.log("🟡 [CART POST] PARSED ITEMS:", items);

    /* ================= VALIDATE ================= */
    for (const item of items) {
      if (!item?.product_id) {
        console.warn("⚠️ [CART POST] MISSING product_id:", item);
      }
    }

    /* ================= DB ================= */
    await upsertCartItems(userId, items);

    console.log("🟢 [CART POST] UPSERT DONE");

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("❌ [CART POST ERROR]:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

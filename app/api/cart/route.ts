import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import {
  getCartByBuyer,
  upsertCartItems,
} from "@/lib/db/orders";

/* ================= GET CART ================= */

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    const items = await getCartByBuyer(userId);

    return NextResponse.json(items);

  } catch (err) {
    console.error("❌ CART GET ERROR:", err);
    return NextResponse.json([], { status: 500 });
  }
}

/* ================= ADD / UPDATE CART ================= */

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    const body = await req.json();

    const items = Array.isArray(body) ? body : [body];

    await upsertCartItems(userId, items);

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("❌ CART POST ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

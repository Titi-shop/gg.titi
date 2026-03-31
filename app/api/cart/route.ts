import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import {
  deleteCartItem,
  getCartByBuyer,
  upsertCartItems,
} from "@/lib/db/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ================= GET CART ================= */

export async function GET() {
  try {
    /* ================= AUTH ================= */
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* ================= DB ================= */
    const items = await getCartByBuyer(userId);

    return NextResponse.json(items);

  } catch {
    console.error("[CART] GET_FAILED");

    return NextResponse.json(
      { error: "GET_CART_FAILED" },
      { status: 500 }
    );
  }
}

/* ================= ADD / UPDATE CART ================= */

type CartItemInput = {
  product_id: string;
  variant_id?: string | null;
  quantity?: number;
};

export async function POST(req: NextRequest) {
  try {
    /* ================= AUTH ================= */
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* ================= BODY ================= */
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const rawItems: unknown[] = Array.isArray(body) ? body : [body];

    const items: CartItemInput[] = rawItems
      .map((item) => {
        if (typeof item !== "object" || item === null) return null;

        const row = item as Record<string, unknown>;

        if (typeof row.product_id !== "string") return null;

        return {
          product_id: row.product_id,
          variant_id:
            typeof row.variant_id === "string"
              ? row.variant_id
              : null,
          quantity:
            typeof row.quantity === "number" &&
            !Number.isNaN(row.quantity)
              ? row.quantity
              : 1,
        };
      })
      .filter((item): item is CartItemInput => item !== null);

    if (items.length === 0) {
      return NextResponse.json(
        { error: "INVALID_ITEMS" },
        { status: 400 }
      );
    }

    /* ================= DB ================= */
    await upsertCartItems(userId, items);

    return NextResponse.json({ success: true });

  } catch {
    console.error("[CART] UPSERT_FAILED");

    return NextResponse.json(
      { error: "UPSERT_CART_FAILED" },
      { status: 500 }
    );
  }
}

/* ================= DELETE CART ITEM ================= */

export async function DELETE(req: NextRequest) {
  try {
    /* ================= AUTH ================= */
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* ================= BODY ================= */
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;

    const productId =
      typeof data.product_id === "string"
        ? data.product_id
        : null;

    const variantId =
      typeof data.variant_id === "string"
        ? data.variant_id
        : null;

    if (!productId) {
      return NextResponse.json(
        { error: "INVALID_PRODUCT_ID" },
        { status: 400 }
      );
    }

    /* ================= DB ================= */
    await deleteCartItem(userId, productId, variantId);

    return NextResponse.json({ success: true });

  } catch {
    console.error("[CART] DELETE_FAILED");

    return NextResponse.json(
      { error: "DELETE_CART_FAILED" },
      { status: 500 }
    );
  }
}

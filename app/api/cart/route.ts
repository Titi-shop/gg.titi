import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import {
  deleteCartItem,
  getCartByBuyer,
  upsertCartItems,
} from "@/lib/db/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   GET CART
========================================================= */

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    console.log("[CART][GET] userId:", userId);

    const items = await getCartByBuyer(userId);

    console.log("[CART][GET] items:", items);

    return NextResponse.json(items);
  } catch (err) {
    console.error("[CART][GET_FAILED]", err);

    return NextResponse.json(
      { error: "GET_CART_FAILED" },
      { status: 500 }
    );
  }
}

/* =========================================================
   POST CART (UPSERT)
========================================================= */

type CartItemInput = {
  product_id: string;
  variant_id?: string | null;
  quantity?: number;
};

export async function POST(req: NextRequest) {
  try {
    /* ===== AUTH ===== */
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    console.log("[CART][POST] userId:", userId);

    /* ===== BODY ===== */
    let body: unknown;

    try {
      body = await req.json();
      console.log("[CART][POST] raw body:", body);
    } catch (err) {
      console.error("[CART][POST] INVALID_BODY", err);

      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const rawItems: unknown[] = Array.isArray(body) ? body : [body];

    console.log("[CART][POST] rawItems:", rawItems);

    /* ===== VALIDATE ===== */
    const items: CartItemInput[] = rawItems
      .map((item, index) => {
        if (typeof item !== "object" || item === null) {
          console.error("[CART][POST] INVALID_ITEM_OBJECT:", index, item);
          return null;
        }

        const row = item as Record<string, unknown>;

        if (typeof row.product_id !== "string") {
          console.error("[CART][POST] INVALID_PRODUCT_ID:", row.product_id);
          return null;
        }

        const parsedItem: CartItemInput = {
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

        return parsedItem;
      })
      .filter((item): item is CartItemInput => item !== null);

    console.log("[CART][POST] parsed items:", items);

    if (items.length === 0) {
      console.error("[CART][POST] INVALID_ITEMS_AFTER_PARSE");

      return NextResponse.json(
        { error: "INVALID_ITEMS" },
        { status: 400 }
      );
    }

    /* ===== DB ===== */
    try {
      await upsertCartItems(userId, items);

      console.log("[CART][POST] UPSERT SUCCESS");

      return NextResponse.json({ success: true });
    } catch (dbErr) {
      console.error("[CART][POST][DB_ERROR]", dbErr);

      return NextResponse.json(
        { error: "UPSERT_CART_FAILED" },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[CART][POST_FAILED]", err);

    return NextResponse.json(
      { error: "UPSERT_CART_FAILED" },
      { status: 500 }
    );
  }
}

/* =========================================================
   DELETE CART ITEM
========================================================= */

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    console.log("[CART][DELETE] userId:", userId);

    let body: unknown;

    try {
      body = await req.json();
      console.log("[CART][DELETE] body:", body);
    } catch (err) {
      console.error("[CART][DELETE] INVALID_BODY", err);

      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    if (typeof body !== "object" || body === null) {
      console.error("[CART][DELETE] BODY_NOT_OBJECT");

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

    console.log("[CART][DELETE] parsed:", {
      productId,
      variantId,
    });

    if (!productId) {
      console.error("[CART][DELETE] INVALID_PRODUCT_ID");

      return NextResponse.json(
        { error: "INVALID_PRODUCT_ID" },
        { status: 400 }
      );
    }

    try {
      await deleteCartItem(userId, productId, variantId);

      console.log("[CART][DELETE] SUCCESS");

      return NextResponse.json({ success: true });
    } catch (dbErr) {
      console.error("[CART][DELETE][DB_ERROR]", dbErr);

      return NextResponse.json(
        { error: "DELETE_CART_FAILED" },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[CART][DELETE_FAILED]", err);

    return NextResponse.json(
      { error: "DELETE_CART_FAILED" },
      { status: 500 }
    );
  }
}

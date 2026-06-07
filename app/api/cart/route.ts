// app/api/cart/route.ts

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireAuth,
} from "@/lib/auth/guard";

import {
  getCart,
  upsertCartItems,
  deleteCartItem,
  updateCartItemQuantity,
  type CartItemInput,
} from "@/lib/db/cart";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

/* =========================================================
   HELPERS
========================================================= */

function badRequest(
  code: string
) {
  return NextResponse.json(
    {
      error: code,
    },
    {
      status: 400,
    }
  );
}

function unauthorized(
  code: string
) {
  return NextResponse.json(
    {
      error: code,
    },
    {
      status: 401,
    }
  );
}

function serverError(
  code: string
) {
  return NextResponse.json(
    {
      error: code,
    },
    {
      status: 500,
    }
  );
}

/* =========================================================
   GET
========================================================= */

export async function GET() {
  try {
    console.log(
      "[API][CART][GET] START"
    );

    const auth =
      await requireAuth();

    if (!auth.ok) {
      console.warn(
        "[API][CART][GET] UNAUTHORIZED"
      );

      return unauthorized(
        "UNAUTHORIZED"
      );
    }

    console.log(
      "[API][CART][GET] AUTH_OK",
      {
        userId:
          auth.userId,
      }
    );

    const cart =
      await getCart(
        auth.userId
      );

    console.log(
      "[API][CART][GET] SUCCESS",
      {
        userId:
          auth.userId,
        count:
          cart.length,
      }
    );

    return NextResponse.json(
      cart
    );
  } catch (err) {
    console.error(
      "[API][CART][GET] ERROR",
      err
    );

    return serverError(
      "GET_CART_FAILED"
    );
  }
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  req: NextRequest
) {
  try {
    console.log(
      "[API][CART][POST] START"
    );

    const auth =
      await requireAuth();

    if (!auth.ok) {
      console.warn(
        "[API][CART][POST] UNAUTHORIZED"
      );

      return unauthorized(
        "UNAUTHORIZED"
      );
    }

    console.log(
      "[API][CART][POST] AUTH_OK",
      {
        userId:
          auth.userId,
      }
    );

    let body: unknown;

    try {
      body =
        await req.json();
    } catch {
      console.error(
        "[API][CART][POST] INVALID_JSON"
      );

      return badRequest(
        "INVALID_JSON"
      );
    }

    console.log(
      "[API][CART][POST] BODY",
      body
    );

    const rawItems:
      unknown[] =
      Array.isArray(body)
        ? body
        : [body];

    const items:
      CartItemInput[] =
      rawItems
        .filter(
          (
            item
          ): item is Record<
            string,
            unknown
          > =>
            typeof item ===
              "object" &&
            item !== null
        )
        .map((item) => ({
          product_id:
            typeof item.product_id ===
            "string"
              ? item.product_id
              : "",

          variant_id:
            typeof item.variant_id ===
            "string"
              ? item.variant_id
              : null,

          quantity:
            typeof item.quantity ===
              "number" &&
            Number.isFinite(
              item.quantity
            )
              ? item.quantity
              : 1,
        }));

    console.log(
      "[API][CART][POST] NORMALIZED",
      {
        count:
          items.length,
        items,
      }
    );

    if (items.length === 0) {
      console.warn(
        "[API][CART][POST] EMPTY_ITEMS"
      );

      return badRequest(
        "INVALID_ITEMS"
      );
    }

    await upsertCartItems(
      auth.userId,
      items
    );

    console.log(
      "[API][CART][POST] UPSERT_DONE"
    );

    const updated =
      await getCart(
        auth.userId
      );

    console.log(
      "[API][CART][POST] SUCCESS",
      {
        userId:
          auth.userId,
        count:
          updated.length,
      }
    );

    return NextResponse.json(
      updated
    );
  } catch (err) {
    console.error(
      "[API][CART][POST] ERROR",
      err
    );

    return serverError(
      "UPSERT_CART_FAILED"
    );
  }
}

/* =========================================================
   PATCH
========================================================= */

export async function PATCH(
  req: NextRequest
) {
  try {
    console.log(
      "[API][CART][PATCH] START"
    );

    const auth =
      await requireAuth();

    if (!auth.ok) {
      console.warn(
        "[API][CART][PATCH] UNAUTHORIZED"
      );

      return unauthorized(
        "UNAUTHORIZED"
      );
    }

    let body: unknown;

    try {
      body =
        await req.json();
    } catch {
      console.error(
        "[API][CART][PATCH] INVALID_JSON"
      );

      return badRequest(
        "INVALID_JSON"
      );
    }

    if (
      typeof body !==
        "object" ||
      body === null
    ) {
      return badRequest(
        "INVALID_BODY"
      );
    }

    const data =
      body as Record<
        string,
        unknown
      >;

    const productId =
      typeof data.product_id ===
      "string"
        ? data.product_id
        : null;

    const variantId =
      typeof data.variant_id ===
      "string"
        ? data.variant_id
        : null;

    const quantity =
      typeof data.quantity ===
        "number" &&
      Number.isFinite(
        data.quantity
      )
        ? data.quantity
        : null;

    console.log(
      "[API][CART][PATCH] INPUT",
      {
        productId,
        variantId,
        quantity,
      }
    );

    if (
      !productId ||
      quantity === null
    ) {
      console.warn(
        "[API][CART][PATCH] INVALID_INPUT"
      );

      return badRequest(
        "INVALID_INPUT"
      );
    }

    await updateCartItemQuantity(
      auth.userId,
      productId,
      variantId,
      quantity
    );

    console.log(
      "[API][CART][PATCH] UPDATE_DONE"
    );

    const updated =
      await getCart(
        auth.userId
      );

    return NextResponse.json(
      updated
    );
  } catch (err) {
    console.error(
      "[API][CART][PATCH] ERROR",
      err
    );

    return serverError(
      "UPDATE_CART_FAILED"
    );
  }
}

/* =========================================================
   DELETE
========================================================= */

export async function DELETE(
  req: NextRequest
) {
  try {
    console.log(
      "[API][CART][DELETE] START"
    );

    const auth =
      await requireAuth();

    if (!auth.ok) {
      console.warn(
        "[API][CART][DELETE] UNAUTHORIZED"
      );

      return unauthorized(
        "UNAUTHORIZED"
      );
    }

    let body: unknown;

    try {
      body =
        await req.json();
    } catch {
      console.error(
        "[API][CART][DELETE] INVALID_JSON"
      );

      return badRequest(
        "INVALID_JSON"
      );
    }

    if (
      typeof body !==
        "object" ||
      body === null
    ) {
      return badRequest(
        "INVALID_BODY"
      );
    }

    const data =
      body as Record<
        string,
        unknown
      >;

    const productId =
      typeof data.product_id ===
      "string"
        ? data.product_id
        : null;

    const variantId =
      typeof data.variant_id ===
      "string"
        ? data.variant_id
        : null;

    console.log(
      "[API][CART][DELETE] INPUT",
      {
        productId,
        variantId,
      }
    );

    if (!productId) {
      console.warn(
        "[API][CART][DELETE] INVALID_PRODUCT_ID"
      );

      return badRequest(
        "INVALID_PRODUCT_ID"
      );
    }

    await deleteCartItem(
      auth.userId,
      productId,
      variantId
    );

    console.log(
      "[API][CART][DELETE] DELETE_DONE"
    );

    const updated =
      await getCart(
        auth.userId
      );

    return NextResponse.json(
      updated
    );
  } catch (err) {
    console.error(
      "[API][CART][DELETE] ERROR",
      err
    );

    return serverError(
      "DELETE_CART_FAILED"
    );
  }
}

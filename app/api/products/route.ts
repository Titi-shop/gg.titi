import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { createProduct } from "@/lib/db/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   POST — CREATE PRODUCT
========================================================= */

export async function POST(req: Request) {
  try {
    /* ================= AUTH ================= */
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { userId, role } = auth;

    /* ================= RBAC ================= */
    if (role !== "seller" && role !== "admin") {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    /* ================= BODY ================= */
    const body = await req.json();

    const {
      name,
      description,
      detail,
      images,
      thumbnail,
      category_id,
      price,
      sale_price,
      sale_start,
      sale_end,
      stock,
      is_active,
    } = body ?? {};

    /* ================= VALIDATION ================= */
    if (typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "INVALID_NAME" },
        { status: 400 }
      );
    }

    if (typeof price !== "number" || Number.isNaN(price)) {
      return NextResponse.json(
        { error: "INVALID_PRICE" },
        { status: 400 }
      );
    }

    if (
      sale_price !== null &&
      sale_price !== undefined &&
      (typeof sale_price !== "number" || Number.isNaN(sale_price))
    ) {
      return NextResponse.json(
        { error: "INVALID_SALE_PRICE" },
        { status: 400 }
      );
    }

    if (!Array.isArray(images)) {
      return NextResponse.json(
        { error: "INVALID_IMAGES" },
        { status: 400 }
      );
    }

    /* ================= CALL DB ================= */
    const product = await createProduct(userId, {
      name: name.trim(),
      description: description ?? "",
      detail: detail ?? "",
      images,
      thumbnail: typeof thumbnail === "string" ? thumbnail : null,
      category_id:
        typeof category_id === "string" ? category_id : null,
      price,
      sale_price: sale_price ?? null,
      sale_start: sale_start ?? null,
      sale_end: sale_end ?? null,
      stock:
        typeof stock === "number" && stock >= 0 ? stock : 0,
      is_active:
        typeof is_active === "boolean" ? is_active : true,
    });

    /* ================= RESPONSE ================= */
    return NextResponse.json({
      success: true,
      data: product,
    });

  } catch (err) {
    console.error("CREATE_PRODUCT_ERROR:", err);

    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}

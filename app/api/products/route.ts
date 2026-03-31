import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import {
  createProduct,
  updateProductBySeller,
  deleteProductBySeller,
  getProductsBySeller,
  getProductsByIds,
} from "@/lib/db/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type OrderStatus = never; // tránh unused (file này không dùng)

/* =========================================================
   GET — SELLER PRODUCTS
========================================================= */

export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { userId, role } = auth;

    if (role !== "seller" && role !== "admin") {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids");

    let products;

    if (idsParam) {
      const ids = idsParam
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      if (ids.length === 0) {
        return NextResponse.json([]);
      }

      products = await getProductsByIds(ids);
    } else {
      products = await getProductsBySeller(userId);
    }

    return NextResponse.json(products);

  } catch (err) {
    console.error("GET_PRODUCTS_ERROR:", err);

    return NextResponse.json(
      { error: "FAILED_TO_FETCH_PRODUCTS" },
      { status: 500 }
    );
  }
}

/* =========================================================
   POST — CREATE PRODUCT
========================================================= */

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { userId, role } = auth;

    if (role !== "seller" && role !== "admin") {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body: unknown = await req.json();

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD" },
        { status: 400 }
      );
    }

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
    } = body as Record<string, unknown>;

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

    if (!Array.isArray(images)) {
      return NextResponse.json(
        { error: "INVALID_IMAGES" },
        { status: 400 }
      );
    }

    if (
      sale_price !== undefined &&
      sale_price !== null &&
      (typeof sale_price !== "number" || Number.isNaN(sale_price))
    ) {
      return NextResponse.json(
        { error: "INVALID_SALE_PRICE" },
        { status: 400 }
      );
    }

    const product = await createProduct(userId, {
      name: name.trim(),
      description: typeof description === "string" ? description : "",
      detail: typeof detail === "string" ? detail : "",
      images: images.filter((i): i is string => typeof i === "string"),
      thumbnail: typeof thumbnail === "string" ? thumbnail : null,
      category_id:
        typeof category_id === "string" ? category_id : null,
      price,
      sale_price:
        typeof sale_price === "number" ? sale_price : null,
      sale_start:
        typeof sale_start === "string" ? sale_start : null,
      sale_end:
        typeof sale_end === "string" ? sale_end : null,
      stock:
        typeof stock === "number" && stock >= 0 ? stock : 0,
      is_active:
        typeof is_active === "boolean" ? is_active : true,
    });

    return NextResponse.json({
      success: true,
      data: product,
    });

  } catch (err) {
    console.error("CREATE_PRODUCT_ERROR:", err);

    return NextResponse.json(
      { error: "FAILED_TO_CREATE_PRODUCT" },
      { status: 500 }
    );
  }
}

/* =========================================================
   PUT — UPDATE PRODUCT
========================================================= */

export async function PUT(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { userId, role } = auth;

    if (role !== "seller" && role !== "admin") {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body: unknown = await req.json();

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD" },
        { status: 400 }
      );
    }

    const {
      id,
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
    } = body as Record<string, unknown>;

    if (typeof id !== "string") {
      return NextResponse.json(
        { error: "INVALID_PRODUCT_ID" },
        { status: 400 }
      );
    }

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

    if (!Array.isArray(images)) {
      return NextResponse.json(
        { error: "INVALID_IMAGES" },
        { status: 400 }
      );
    }

    const updated = await updateProductBySeller(userId, id, {
      name: name.trim(),
      description: typeof description === "string" ? description : "",
      detail: typeof detail === "string" ? detail : "",
      images: images.filter((i): i is string => typeof i === "string"),
      thumbnail: typeof thumbnail === "string" ? thumbnail : null,
      category_id:
        typeof category_id === "string" ? category_id : null,
      price,
      sale_price:
        typeof sale_price === "number" ? sale_price : null,
      sale_start:
        typeof sale_start === "string" ? sale_start : null,
      sale_end:
        typeof sale_end === "string" ? sale_end : null,
      stock:
        typeof stock === "number" && stock >= 0 ? stock : 0,
      is_active:
        typeof is_active === "boolean" ? is_active : true,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND_OR_FORBIDDEN" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("UPDATE_PRODUCT_ERROR:", err);

    return NextResponse.json(
      { error: "FAILED_TO_UPDATE_PRODUCT" },
      { status: 500 }
    );
  }
}

/* =========================================================
   DELETE — DELETE PRODUCT
========================================================= */

export async function DELETE(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { userId, role } = auth;

    if (role !== "seller" && role !== "admin") {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "INVALID_PRODUCT_ID" },
        { status: 400 }
      );
    }

    const deleted = await deleteProductBySeller(userId, id);

    if (!deleted) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND_OR_FORBIDDEN" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("DELETE_PRODUCT_ERROR:", err);

    return NextResponse.json(
      { error: "FAILED_TO_DELETE_PRODUCT" },
      { status: 500 }
    );
  }
}

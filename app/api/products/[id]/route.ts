
import { NextRequest, NextResponse } from "next/server";
import { updateProductBySeller } from "@/lib/db/products";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { query } from "@/lib/db";
import {
  getVariantsByProductId,
  replaceVariantsByProductId,
  type ProductVariant,
} from "@/lib/db/variants";
/* =========================
   TYPES
========================= */
type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  detail: string | null;
  images: string[] | null;
  thumbnail: string | null;
  category_id: string | null;
  price: number;
  sale_price: number | null;
  sale_start: string | null;
  sale_end: string | null;
  views: number | null;
  sold: number | null;
  stock: number | null;
  is_active: boolean | null;
  rating_avg: number | null;
  rating_count: number | null;
};

type PatchBody = {
  name?: string;
  description?: string;
  detail?: string;
  images?: string[];
  thumbnail?: string | null;
  categoryId?: string | null;
  price?: number;
  salePrice?: number | null;
  saleStart?: string | null;
  saleEnd?: string | null;
  stock?: number;
  is_active?: boolean;
  variants?: ProductVariant[];
};


function normalizeVariants(input: unknown): ProductVariant[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item, index) => {
      if (typeof item !== "object" || item === null) return null;

      const row = item as Record<string, unknown>;

      const optionValue =
        typeof row.optionValue === "string"
          ? row.optionValue.trim()
          : "";

      if (!optionValue) return null;

      return {
        id: typeof row.id === "string" ? row.id : undefined,
        optionName:
          typeof row.optionName === "string" && row.optionName.trim() !== ""
            ? row.optionName.trim()
            : "size",
        optionValue,
        stock:
          typeof row.stock === "number" &&
          !Number.isNaN(row.stock) &&
          row.stock >= 0
            ? row.stock
            : 0,
        sku:
          typeof row.sku === "string" && row.sku.trim() !== ""
            ? row.sku.trim()
            : null,
        sortOrder:
          typeof row.sortOrder === "number" && !Number.isNaN(row.sortOrder)
            ? row.sortOrder
            : index,
        isActive:
          typeof row.isActive === "boolean"
            ? row.isActive
            : true,
      };
    })
    .filter((item): item is ProductVariant => item !== null);
}

function getTotalVariantStock(variants: ProductVariant[]) {
  return variants.reduce((sum, item) => sum + (item.stock || 0), 0);
}

/* =========================
   PATCH /api/products/[id]
========================= */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    /* =========================
       1️⃣ AUTH
    ========================= */
    const user = await getUserFromBearer();

    if (!user) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    /* =========================
       2️⃣ MAP pi_uid → UUID + ROLE
    ========================= */
    const userRes = await query(
      `SELECT id, role FROM users WHERE pi_uid = $1 LIMIT 1`,
      [user.pi_uid]
    );

    if (userRes.rowCount === 0) {
      return NextResponse.json(
        { error: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    const { id: userId, role } = userRes.rows[0];

    if (role !== "seller" && role !== "admin") {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    /* =========================
       3️⃣ VALIDATE ID
    ========================= */
    if (!id) {
      return NextResponse.json(
        { error: "MISSING_PRODUCT_ID" },
        { status: 400 }
      );
    }

    /* =========================
       4️⃣ CHECK OWNERSHIP
    ========================= */
    const ownerCheck = await query(
      `SELECT seller_id FROM products WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (ownerCheck.rowCount === 0) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND" },
        { status: 404 }
      );
    }

    const sellerId = ownerCheck.rows[0].seller_id;

    if (sellerId !== userId && role !== "admin") {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    /* =========================
       5️⃣ BODY
    ========================= */
    const body = (await req.json()) as PatchBody;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const normalizedVariants = normalizeVariants(body.variants);
    const hasVariants = normalizedVariants.length > 0;

    const finalStock = hasVariants
      ? getTotalVariantStock(normalizedVariants)
      : typeof body.stock === "number" && body.stock >= 0
      ? body.stock
      : 0;

    /* =========================
       6️⃣ BUILD PAYLOAD (SAFE)
    ========================= */
    const updatePayload: Record<string, unknown> = {
      name:
        body.name !== undefined && typeof body.name === "string"
          ? body.name.trim()
          : undefined,

      description:
        body.description !== undefined
          ? body.description
          : undefined,

      detail:
        body.detail !== undefined
          ? body.detail
          : undefined,

      images:
        body.images !== undefined
          ? Array.isArray(body.images)
            ? body.images.filter((i): i is string => typeof i === "string")
            : []
          : undefined,

      category_id:
        body.categoryId !== undefined
          ? typeof body.categoryId === "string" &&
            body.categoryId.trim() !== ""
            ? body.categoryId
            : null
          : undefined,

      price:
        body.price !== undefined &&
        typeof body.price === "number" &&
        !Number.isNaN(body.price)
          ? body.price
          : undefined,

      sale_price:
        body.salePrice !== undefined &&
        typeof body.salePrice === "number"
          ? body.salePrice
          : null,

      sale_start:
        body.saleStart !== undefined
          ? body.saleStart
          : undefined,

      sale_end:
        body.saleEnd !== undefined
          ? body.saleEnd
          : undefined,

      stock: finalStock,

      is_active:
        body.is_active !== undefined
          ? body.is_active
          : undefined,

      thumbnail:
        body.thumbnail !== undefined
          ? body.thumbnail
          : undefined,
    };

    /* =========================
       7️⃣ REMOVE UNDEFINED
    ========================= */
    const cleanPayload = Object.fromEntries(
      Object.entries(updatePayload).filter(([_, v]) => v !== undefined)
    );

    /* =========================
   8️⃣ UPDATE DB (CHUẨN)
========================= */
const updated = await updateProductBySeller(
  userId,
  id,
  cleanPayload
);

if (!updated) {
  return NextResponse.json(
    { error: "PRODUCT_NOT_FOUND_OR_FORBIDDEN" },
    { status: 404 }
  );
}

    /* =========================
   9️⃣ FETCH UPDATED PRODUCT
========================= */
const result = await query(
  `SELECT * FROM products WHERE id = $1 LIMIT 1`,
  [id]
);

if (result.rowCount === 0) {
  return NextResponse.json(
    { error: "PRODUCT_NOT_FOUND" },
    { status: 404 }
  );
}

const p = result.rows[0];
    /* =========================
       9️⃣ VARIANTS
    ========================= */
    if (Array.isArray(body.variants)) {
      await replaceVariantsByProductId(id, normalizedVariants);
    }

    const updatedVariants = await getVariantsByProductId(id);

    /* =========================
       🔟 RESPONSE
    ========================= */
    return NextResponse.json({
  id: p.id,
  name: p.name,
  price: p.price,

  salePrice: p.sale_price ?? null,
  saleStart: p.sale_start ?? null,
  saleEnd: p.sale_end ?? null,

  description: p.description ?? "",
  detail: p.detail ?? "",

  images: p.images ?? [],
  thumbnail: p.thumbnail ?? (p.images?.[0] ?? ""),

  categoryId: p.category_id ?? "",
  stock: p.stock ?? 0,
  is_active: p.is_active ?? true,

  views: p.views ?? 0,
  sold: p.sold ?? 0,
  rating_avg: p.rating_avg ?? 0,
  rating_count: p.rating_count ?? 0,

  variants: updatedVariants,
});
  } catch (err) {
    console.error("❌ PRODUCT PATCH ERROR:", err);

    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}

/* =========================
   GET /api/products/[id]
========================= */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "MISSING_PRODUCT_ID" },
        { status: 400 }
      );
    }

    /* =========================
       🔐 AUTH (NÊN CÓ)
    ========================= */
    const user = await getUserFromBearer(req);

    if (!user?.pi_uid) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    /* =========================
       🔁 MAP USER
    ========================= */
    const userRes = await query<{ id: string }>(
      `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
      [user.pi_uid]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json(
        { error: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    const userId = userRes.rows[0].id;

    /* =========================
       📦 GET PRODUCT (DB LAYER)
    ========================= */
    const product = await getProductById(id);

    if (!product) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND" },
        { status: 404 }
      );
    }

    /* =========================
       🔐 OPTIONAL: OWNERSHIP CHECK
    ========================= */
    if (product.seller_id !== userId) {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    /* =========================
       📦 VARIANTS
    ========================= */
    const variants = await getVariantsByProductId(id);

    /* =========================
       ✅ RESPONSE
    ========================= */
    return NextResponse.json({
      ...product,
      variants,
    });

  } catch (err) {
    console.error("❌ PRODUCT [ID] ERROR:", err);

    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}

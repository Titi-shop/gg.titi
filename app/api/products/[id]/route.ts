
import { NextRequest, NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import {
  updateProductBySeller,
  getProductById,
  deleteProductById,
} from "@/lib/db/products";
import {
  upsertShippingRates,
  getShippingRatesByProduct,
} from "@/lib/db/shipping";
import {
  getVariantsByProductId,
  replaceVariantsByProductId,
  type ProductVariant,
} from "@/lib/db/variants";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

interface PatchBody {
  name?: string;
  description?: string;
  detail?: string;
  images?: string[];
  thumbnail?: string | null;
  categoryId?: string | number | null;

  price?: number;
  stock?: number;

  saleEnabled?: boolean;
  salePrice?: number | null;
  saleStock?: number;
  saleStart?: string | null;
  saleEnd?: string | null;

  isActive?: boolean;

  variants?: unknown[];
  shippingRates?: {
    zone: string;
    price: number;
  }[];

  domesticCountryCode?: string | null;
}

/* =========================================================
   NORMALIZE VARIANTS
========================================================= */

function normalizeVariants(input: unknown): ProductVariant[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item, index): ProductVariant | null => {
      if (!item || typeof item !== "object") return null;

      const raw = item as Record<string, unknown>;

      const option1 = String(raw.option1 ?? raw.optionValue ?? "").trim();
      const option2 = String(raw.option2 ?? "").trim() || null;
      const option3 = String(raw.option3 ?? "").trim() || null;

      if (!option1) return null;

      const price =
        typeof raw.price === "number" && !Number.isNaN(raw.price)
          ? raw.price
          : 0;

      const salePrice =
        typeof raw.salePrice === "number" && !Number.isNaN(raw.salePrice)
          ? raw.salePrice
          : null;

      const saleEnabled = raw.saleEnabled === true;

      const finalPrice =
        saleEnabled &&
        salePrice !== null &&
        salePrice > 0 &&
        salePrice < price
          ? salePrice
          : price;

      return {
        id: typeof raw.id === "string" ? raw.id : undefined,

        option1,
        option2,
        option3,

        optionLabel1:
          typeof raw.optionLabel1 === "string" ? raw.optionLabel1 : null,
        optionLabel2:
          typeof raw.optionLabel2 === "string" ? raw.optionLabel2 : null,
        optionLabel3:
          typeof raw.optionLabel3 === "string" ? raw.optionLabel3 : null,

        optionName:
          typeof raw.optionLabel1 === "string" ? raw.optionLabel1 : "option",
        optionValue: option1,

        name:
          typeof raw.name === "string"
            ? raw.name
            : [option1, option2, option3].filter(Boolean).join(" - "),

        sku: typeof raw.sku === "string" ? raw.sku : null,

        price,
        salePrice,
        finalPrice,

        stock:
          typeof raw.stock === "number" && !Number.isNaN(raw.stock)
            ? raw.stock
            : 0,

        isUnlimited: raw.isUnlimited === true,

        saleEnabled,

        saleStock:
          typeof raw.saleStock === "number" && !Number.isNaN(raw.saleStock)
            ? raw.saleStock
            : 0,

        saleSold:
          typeof raw.saleSold === "number" && !Number.isNaN(raw.saleSold)
            ? raw.saleSold
            : 0,

        image: typeof raw.image === "string" ? raw.image : "",

        sortOrder:
          typeof raw.sortOrder === "number" && !Number.isNaN(raw.sortOrder)
            ? raw.sortOrder
            : index,

        isActive: raw.isActive !== false,

        sold:
          typeof raw.sold === "number" && !Number.isNaN(raw.sold)
            ? raw.sold
            : 0,
      };
    })
    .filter((v): v is ProductVariant => v !== null);
}

/* =========================================================
   GET
========================================================= */

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const id = params.id;

    if (!id) {
      return NextResponse.json({ error: "MISSING_PRODUCT_ID" }, { status: 400 });
    }

    const p = await getProductById(id);

    if (!p) {
      return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 404 });
    }

    const rawVariants = await getVariantsByProductId(id);
    const hasVariants = rawVariants.length > 0;

    const now = Date.now();
    const start = p.sale_start ? new Date(p.sale_start).getTime() : null;
    const end = p.sale_end ? new Date(p.sale_end).getTime() : null;

    const variants = rawVariants.map((v) => {
      const salePrice =
        typeof v.salePrice === "number" ? v.salePrice : null;

      const isVariantSale =
        Boolean(v.saleEnabled) &&
        salePrice !== null &&
        start !== null &&
        end !== null &&
        now >= start &&
        now <= end;

      return {
        ...v,
        isSale: isVariantSale,
        saleLeft:
          typeof v.saleStock === "number"
            ? Math.max(0, v.saleStock - (v.saleSold ?? 0))
            : 0,
      };
    });

    const totalStock = hasVariants
      ? variants.reduce((s, v) => s + (v.stock || 0), 0)
      : p.stock ?? 0;

    const minPrice = hasVariants
      ? Math.min(...variants.map((v) => Number(v.finalPrice || v.price || 0)))
      : null;

    const maxPrice = hasVariants
      ? Math.max(...variants.map((v) => Number(v.finalPrice || v.price || 0)))
      : null;

    const shippingRates = await getShippingRatesByProduct(id);

    const isProductSale =
      !hasVariants &&
      typeof p.sale_price === "number" &&
      start !== null &&
      end !== null &&
      now >= start &&
      now <= end;

    const finalPrice = isProductSale ? p.sale_price ?? p.price : p.price;

    return NextResponse.json({
      id: p.id,
      sellerId: p.seller_id,
      name: p.name,
      slug: p.slug ?? "",
      description: p.description ?? "",
      detail: p.detail ?? "",
      thumbnail: p.thumbnail ?? "",
      images: p.images ?? [],
      hasVariants,

      price: hasVariants ? null : p.price ?? 0,
      salePrice: hasVariants ? p.sale_price ?? null : p.sale_price ?? null,
      finalPrice: hasVariants ? minPrice : finalPrice,

      minPrice,
      maxPrice,

      stock: totalStock,

      saleEnabled: p.sale_enabled === true,
      saleStock: p.sale_stock ?? 0,
      saleSold: p.sale_sold ?? 0,
      saleLeft:
        typeof p.sale_stock === "number"
          ? Math.max(0, p.sale_stock - (p.sale_sold ?? 0))
          : 0,

      saleStart: p.sale_start ?? null,
      saleEnd: p.sale_end ?? null,

      isProductSale,
      isActive: p.is_active ?? true,
      categoryId: p.category_id ?? null,

      variants,
      shippingRates,
    });
  } catch (err) {
    console.error("[PRODUCT][GET]", err);
    return NextResponse.json(
      { error: "FAILED_TO_FETCH_PRODUCT" },
      { status: 500 }
    );
  }
}

/* =========================================================
   PATCH
========================================================= */

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const userId = auth.userId;

  try {
    const id = params.id;

    if (!id) {
      return NextResponse.json({ error: "INVALID_PRODUCT_ID" }, { status: 400 });
    }

    const body = (await req.json()) as PatchBody;

    const normalizedVariants = normalizeVariants(body.variants);
    const hasVariants = normalizedVariants.length > 0;

    const saleStart =
      typeof body.saleStart === "string" && body.saleStart ? body.saleStart : null;

    const saleEnd =
      typeof body.saleEnd === "string" && body.saleEnd ? body.saleEnd : null;

    const productSaleEnabled = body.saleEnabled === true;

    const productSalePrice =
      typeof body.salePrice === "number" && !Number.isNaN(body.salePrice)
        ? body.salePrice
        : null;

    let finalPrice =
      typeof body.price === "number" && !Number.isNaN(body.price)
        ? body.price
        : 1;

    let finalSalePrice = productSalePrice;
    let finalStock =
      typeof body.stock === "number" && !Number.isNaN(body.stock)
        ? body.stock
        : 0;

    let finalSaleStock =
      typeof body.saleStock === "number" && !Number.isNaN(body.saleStock)
        ? body.saleStock
        : 0;

    let finalSaleEnabled = productSaleEnabled;

    if (hasVariants) {
      const prices = normalizedVariants.map((v) => v.price).filter((p) => p > 0);
      const salePrices = normalizedVariants
        .map((v) => v.salePrice)
        .filter((p): p is number => p !== null && p > 0);

      finalPrice = prices.length ? Math.min(...prices) : 1;
      finalSalePrice = salePrices.length ? Math.min(...salePrices) : null;
      finalStock = normalizedVariants.reduce((s, v) => s + v.stock, 0);
      finalSaleStock = normalizedVariants.reduce(
        (s, v) => s + (v.saleEnabled ? v.saleStock : 0),
        0
      );
      finalSaleEnabled = normalizedVariants.some(
        (v) => v.saleEnabled && v.salePrice !== null && v.salePrice > 0
      );
    }

    const hasAnySale = finalSaleEnabled && finalSalePrice !== null;

    if (hasAnySale && (!saleStart || !saleEnd)) {
      return NextResponse.json(
        { error: "SALE_TIME_REQUIRED" },
        { status: 400 }
      );
    }

    const categoryId =
      typeof body.categoryId === "string"
        ? Number(body.categoryId)
        : typeof body.categoryId === "number"
        ? body.categoryId
        : null;

    const updated = await updateProductBySeller(userId, id, {
      name: typeof body.name === "string" ? body.name.trim() : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      detail: typeof body.detail === "string" ? body.detail : undefined,

      images: Array.isArray(body.images)
        ? body.images.filter((i): i is string => typeof i === "string")
        : undefined,

      thumbnail:
        body.thumbnail === undefined
          ? undefined
          : typeof body.thumbnail === "string"
          ? body.thumbnail
          : null,

      category_id: categoryId,

      price: finalPrice,
      sale_price: finalSalePrice,

      stock: finalStock,

      sale_enabled: finalSaleEnabled,
      sale_stock: finalSaleStock,
      sale_start: hasAnySale ? saleStart : null,
      sale_end: hasAnySale ? saleEnd : null,

      is_active:
        typeof body.isActive === "boolean" ? body.isActive : undefined,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND_OR_FORBIDDEN" },
        { status: 404 }
      );
    }

    if (Array.isArray(body.shippingRates)) {
      await upsertShippingRates({
        productId: id,
        rates: body.shippingRates.map((r) => ({
          zone: r.zone,
          price: Number(r.price || 0),
          domesticCountryCode:
            r.zone === "domestic"
              ? body.domesticCountryCode ?? null
              : null,
        })),
      });
    }

    if (hasVariants) {
      await replaceVariantsByProductId(id, normalizedVariants);
    }

    return NextResponse.json({
      success: true,
      data: {
        id,
        name: updated.name,
        price: finalPrice,
        salePrice: finalSalePrice,
        stock: finalStock,
      },
    });
  } catch (err) {
    console.error("[PRODUCT][PATCH]", err);

    return NextResponse.json(
      { error: "FAILED_TO_UPDATE_PRODUCT" },
      { status: 500 }
    );
  }
}

/* =========================================================
   DELETE
========================================================= */

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  try {
    const id = params.id;

    if (!id) {
      return NextResponse.json({ error: "INVALID_PRODUCT_ID" }, { status: 400 });
    }

    const result = await deleteProductById(id, auth.userId);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (result.paths.length > 0) {
      await supabaseAdmin.storage.from("products").remove(result.paths);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PRODUCT][DELETE]", err);

    return NextResponse.json(
      { error: "FAILED_TO_DELETE_PRODUCT" },
      { status: 500 }
    );
  }
}

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
   FORENSIC LOG
========================================================= */
function flog(step: string, data?: unknown) {
  console.log(`🧪 [PRODUCT API] ${step}`, data ?? "");
}

/* =========================================================
   SAFE VARIANT NORMALIZE
========================================================= */
function normalizeVariants(input: unknown): ProductVariant[] {
  flog("NORMALIZE_VARIANTS_INPUT", input);

  if (!Array.isArray(input)) {
    flog("NORMALIZE_VARIANTS_EMPTY_ARRAY");
    return [];
  }

  const result = input
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;

      const v = item as Record<string, unknown>;

      const option1 = String(v.option1 ?? v.optionValue ?? "").trim();
      const option2 = String(v.option2 ?? "").trim() || null;
      const option3 = String(v.option3 ?? "").trim() || null;

      if (!option1) {
        flog(`VARIANT_${index}_SKIPPED_NO_OPTION1`);
        return null;
      }

      const price =
        typeof v.price === "number" && !Number.isNaN(v.price)
          ? v.price
          : Number(v.price) || 0;

      const salePrice =
        v.salePrice !== null &&
        v.salePrice !== undefined &&
        !Number.isNaN(Number(v.salePrice))
          ? Number(v.salePrice)
          : null;

      const saleEnabled = Boolean(v.saleEnabled);

      const finalPrice =
        saleEnabled &&
        salePrice !== null &&
        salePrice > 0 &&
        salePrice < price
          ? salePrice
          : price;

      const normalized: ProductVariant = {
        id: typeof v.id === "string" ? v.id : undefined,

        option1,
        option2,
        option3,

        optionLabel1:
          typeof v.optionLabel1 === "string" ? v.optionLabel1 : null,
        optionLabel2:
          typeof v.optionLabel2 === "string" ? v.optionLabel2 : null,
        optionLabel3:
          typeof v.optionLabel3 === "string" ? v.optionLabel3 : null,

        optionName:
          typeof v.optionLabel1 === "string" ? v.optionLabel1 : "option",

        optionValue: option1,

        name:
          typeof v.name === "string"
            ? v.name
            : [option1, option2, option3].filter(Boolean).join(" - "),

        sku: typeof v.sku === "string" ? v.sku : null,

        price,
        salePrice,
        finalPrice,

        stock: Number(v.stock) || 0,
        isUnlimited: Boolean(v.isUnlimited),

        saleEnabled,
        saleStock: Number(v.saleStock ?? 0),
        saleSold: Number(v.saleSold ?? 0),

        image: typeof v.image === "string" ? v.image : "",

        sortOrder: Number(v.sortOrder ?? index),
        isActive: v.isActive !== false,

        sold: Number(v.sold ?? 0),
      };

      flog(`VARIANT_${index}_NORMALIZED`, normalized);
      return normalized;
    })
    .filter(Boolean) as ProductVariant[];

  flog("NORMALIZE_VARIANTS_DONE", result);
  return result;
}

/* =========================================================
   GET
========================================================= */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  flog("GET_START", params);

  try {
    const id = params.id;

    if (!id) {
      return NextResponse.json({ error: "INVALID_PRODUCT_ID" }, { status: 400 });
    }

    const p = await getProductById(id);
    flog("GET_PRODUCT_DB", p);

    if (!p) {
      return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 404 });
    }

    const rawVariants = await getVariantsByProductId(id);
    flog("GET_RAW_VARIANTS", rawVariants);

    const shippingRates = await getShippingRatesByProduct(id);
    flog("GET_SHIPPING", shippingRates);

    return NextResponse.json({
      id: p.id,
      sellerId: p.seller_id,
      name: p.name,
      description: p.description ?? "",
      detail: p.detail ?? "",
      images: p.images ?? [],
      thumbnail: p.thumbnail ?? "",
      categoryId: p.category_id ?? null,
      price: p.price ?? 0,
      salePrice: p.sale_price ?? null,
      saleEnabled: p.sale_enabled ?? false,
      saleStock: p.sale_stock ?? 0,
      saleStart: p.sale_start ?? null,
      saleEnd: p.sale_end ?? null,
      stock: p.stock ?? 0,
      isActive: p.is_active ?? true,
      shippingRates,
      variants: rawVariants,
    });
  } catch (err) {
    console.error("💥 [PRODUCT API][GET ERROR]", err);
    return NextResponse.json({ error: "FAILED_TO_FETCH_PRODUCT" }, { status: 500 });
  }
}

/* =========================================================
   PATCH
========================================================= */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  flog("PATCH_START");

  const auth = await requireSeller();
  flog("PATCH_AUTH", auth);

  if (!auth.ok) return auth.response;

  const userId = auth.userId;
  const productId = params.id;

  try {
    if (!productId) {
      return NextResponse.json({ error: "INVALID_PRODUCT_ID" }, { status: 400 });
    }

    const body = await req.json();
    flog("PATCH_RAW_BODY", body);

    const normalizedVariants = normalizeVariants(body.variants);
    const hasVariants = normalizedVariants.length > 0;

    flog("PATCH_HAS_VARIANTS", hasVariants);

    const safeSaleEnabled =
      !hasVariants &&
      typeof body.saleEnabled === "boolean"
        ? body.saleEnabled
        : false;

    const safeSalePrice =
      !hasVariants &&
      typeof body.salePrice === "number" &&
      !Number.isNaN(body.salePrice)
        ? body.salePrice
        : null;

    const safeSaleStock =
      !hasVariants &&
      typeof body.saleStock === "number" &&
      !Number.isNaN(body.saleStock)
        ? body.saleStock
        : 0;

    const safeSaleStart =
      !hasVariants && typeof body.saleStart === "string"
        ? body.saleStart
        : null;

    const safeSaleEnd =
      !hasVariants && typeof body.saleEnd === "string"
        ? body.saleEnd
        : null;

    const finalStock = hasVariants
      ? normalizedVariants.reduce((sum, v) => sum + (v.stock || 0), 0)
      : typeof body.stock === "number"
      ? body.stock
      : 0;

    const finalPrice = hasVariants
      ? Math.min(...normalizedVariants.map((v) => v.price || 0))
      : typeof body.price === "number"
      ? body.price
      : 0;

    flog("PATCH_FINAL_COMPUTED", {
      safeSaleEnabled,
      safeSalePrice,
      safeSaleStock,
      safeSaleStart,
      safeSaleEnd,
      finalStock,
      finalPrice,
    });

    const updated = await updateProductBySeller(userId, productId, {
      name: typeof body.name === "string" ? body.name.trim() : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      detail: typeof body.detail === "string" ? body.detail : undefined,

      images: Array.isArray(body.images)
        ? body.images.filter((x: unknown): x is string => typeof x === "string")
        : undefined,

      thumbnail:
        typeof body.thumbnail === "string" ? body.thumbnail : undefined,

      category_id:
        typeof body.categoryId === "string"
          ? Number(body.categoryId)
          : typeof body.categoryId === "number"
          ? body.categoryId
          : undefined,

      price: finalPrice,
      stock: finalStock,

      sale_price: safeSalePrice,
      sale_enabled: safeSaleEnabled,
      sale_stock: safeSaleStock,
      sale_start: safeSaleStart,
      sale_end: safeSaleEnd,

      is_active:
        typeof body.isActive === "boolean" ? body.isActive : undefined,
    });

    flog("PATCH_DB_UPDATED", updated);

    if (!updated) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND_OR_FORBIDDEN" },
        { status: 404 }
      );
    }

    if (Array.isArray(body.shippingRates)) {
      flog("PATCH_SHIPPING_START", body.shippingRates);

      await upsertShippingRates({
        productId,
        rates: body.shippingRates.map((r: Record<string, unknown>) => ({
          zone: String(r.zone),
          price: Number(r.price || 0),
          domesticCountryCode:
            String(r.zone) === "domestic"
              ? String(body.domesticCountryCode ?? "") || null
              : null,
        })),
      });

      flog("PATCH_SHIPPING_DONE");
    }

    if (hasVariants) {
      flog("PATCH_VARIANT_REPLACE_START", normalizedVariants);
      await replaceVariantsByProductId(productId, normalizedVariants);
      flog("PATCH_VARIANT_REPLACE_DONE");
    }

    flog("PATCH_SUCCESS");

    return NextResponse.json({
      success: true,
      data: {
        id: productId,
        price: finalPrice,
        stock: finalStock,
      },
    });
  } catch (err) {
    console.error("💥 [PRODUCT API][PATCH ERROR FULL]", err);
    return NextResponse.json({ error: "FAILED_TO_UPDATE_PRODUCT" }, { status: 500 });
  }
}

/* =========================================================
   DELETE
========================================================= */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  flog("DELETE_START", params);

  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  try {
    const result = await deleteProductById(params.id, auth.userId);
    flog("DELETE_DB_RESULT", result);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (result.paths.length) {
      const { error } = await supabaseAdmin.storage
        .from("products")
        .remove(result.paths);

      if (error) {
        console.error("💥 STORAGE DELETE ERROR", error);
      } else {
        flog("DELETE_STORAGE_DONE");
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("💥 [PRODUCT API][DELETE ERROR FULL]", err);
    return NextResponse.json({ error: "FAILED_TO_DELETE_PRODUCT" }, { status: 500 });
  }
}

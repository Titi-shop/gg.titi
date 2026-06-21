import { NextRequest, NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";

import {
  getProductService,
  updateProductService,
  deleteProductService,
} from "@/lib/services/products/by-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ================= GET ================= */
export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  console.log(
    "🚀 PRODUCT_ROUTE_GET",
    {
      id: ctx.params.id,
    }
  );

  const result =
    await getProductService(
      ctx.params.id
    );

  console.log(
  "📦 PRODUCT_ROUTE_RESPONSE",
  {
    error:
      "error" in result
        ? result.error
        : null,

    id:
      "id" in result
        ? result.id
        : null,

    category_id:
      "category_id" in result
        ? result.category_id
        : null,

    has_variants:
      "has_variants" in result
        ? result.has_variants
        : null,

    price:
      "price" in result
        ? result.price
        : null,

    sale_price:
      "sale_price" in result
        ? result.sale_price
        : null,

    final_price:
      "final_price" in result
        ? result.final_price
        : null,

    stock:
      "stock" in result
        ? result.stock
        : null,

    sale_stock:
      "sale_stock" in result
        ? result.sale_stock
        : null,

    sale_enabled:
      "sale_enabled" in result
        ? result.sale_enabled
        : null,

    sale_start:
      "sale_start" in result
        ? result.sale_start
        : null,

    sale_end:
      "sale_end" in result
        ? result.sale_end
        : null,

    variantCount:
      "variants" in result
        ? result.variants?.length ?? 0
        : 0,

    shippingCount:
      "shipping_rates" in result
        ? result.shipping_rates?.length ?? 0
        : 0,
  }
);
  return NextResponse.json(result);
}
/* ================= PATCH ================= */
export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const result = await updateProductService(
    ctx.params.id,
    auth.userId,
    await req.json()
  );

  return NextResponse.json(result);
}

/* ================= DELETE ================= */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: { id: string } }
) {
  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const result = await deleteProductService(
    ctx.params.id,
    auth.userId
  );

  return NextResponse.json(result);
}

import { NextRequest, NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";

import {
  getProductService,
  updateProductService,
  deleteProductService,
} from "@/lib/services/products.by-id.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ================= GET ================= */
export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  const result = await getProductService(ctx.params.id);
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


  import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import {
  listProductsService,
  createProductService,
  updateProductService,
  deleteProductService,
} from "@/lib/services/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ================= GET ================= */
export async function GET(req: Request) {
  const t0 = performance.now();

  const result = await listProductsService(req);
  console.log(
    "⏱️ API /products GET TOTAL:",
    (performance.now() - t0).toFixed(2),
    "ms"
  );
  return NextResponse.json(result);
}
/* ================= POST ================= */
export async function POST(req: Request) {
  console.log("🚀 API /products POST HIT");

  const auth = await requireSeller();

  console.log("🔐 AUTH RESULT", {
    ok: auth.ok,
    userId: auth.ok ? auth.userId : null,
  });

  if (!auth.ok) {
    console.log("❌ AUTH FAILED");
    return auth.response;
  }

  const result = await createProductService(
    req,
    auth.userId
  );

  console.log(
    "📦 CREATE PRODUCT RESULT",
    JSON.stringify(result, null, 2)
  );

  return NextResponse.json(result);
}

/* ================= PUT ================= */
export async function PUT(req: Request) {
  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const result = await updateProductService(req, auth.userId);
  return NextResponse.json(result);
}

/* ================= DELETE ================= */
export async function DELETE(req: Request) {
  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const result = await deleteProductService(req, auth.userId);
  return NextResponse.json(result);
}

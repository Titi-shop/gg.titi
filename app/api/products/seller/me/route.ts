import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { getSellerProducts } from "@/lib/db/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    /* =========================
       1️⃣ AUTH + RBAC
    ========================= */
    const auth = await requireSeller();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* =========================
       2️⃣ DB
    ========================= */
    const products = await getSellerProducts(userId);

    /* =========================
       3️⃣ RESPONSE
    ========================= */
    return NextResponse.json(products);

  } catch (err) {
    console.error("❌ SELLER PRODUCTS ERROR:", err);

    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}

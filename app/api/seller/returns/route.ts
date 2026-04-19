import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { getReturnsBySeller } from "@/lib/db/returns";

export const runtime = "nodejs";

/* =====================================================
   GET /api/seller/returns
===================================================== */

export async function GET(req: NextRequest) {
  console.log("🚀 [SELLER RETURNS API] START");

  try {
    /* ================= AUTH ================= */
    const auth = await requireSeller();

    if (!auth.ok) {
      return auth.response;
    }

    const sellerId = auth.userId;

    console.log("👤 SELLER:", sellerId);

    /* ================= QUERY PARAM ================= */
    const url = new URL(req.url);
    const status = url.searchParams.get("status"); // 👈 CHÍNH LÀ DÒNG BẠN HỎI

    console.log("🔎 FILTER STATUS:", status);

    /* ================= DB ================= */
    const items = await getReturnsBySeller(
      sellerId,
      status // 👈 TRUYỀN XUỐNG DB
    );

    console.log("📦 RETURNS:", items.length);

    return NextResponse.json({
      items,
    });

  } catch (err) {
    console.error("💥 API ERROR:", err);

    return NextResponse.json(
      { error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

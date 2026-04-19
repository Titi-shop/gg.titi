import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { query } from "@/lib/db";

export const runtime = "nodejs";

/* =====================================================
   GET SELLER RETURNS
===================================================== */

export async function GET() {
  console.log("🚀 [SELLER RETURNS API] START");

  try {
    /* ================= AUTH ================= */
    const auth = await requireSeller();

    console.log("🔐 AUTH:", auth);

    if (!auth.ok) {
      return auth.response;
    }

    const sellerId = auth.userId;

    console.log("👤 SELLER:", sellerId);

    /* ================= QUERY ================= */

    const { rows } = await query(
      `
      SELECT
        id,
        return_number,
        order_id,
        status,
        refund_amount,
        created_at
      FROM returns
      WHERE seller_id = $1
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      `,
      [sellerId]
    );

    console.log("📦 RETURNS COUNT:", rows.length);

    return NextResponse.json({
      items: rows,
    });

  } catch (err) {
    console.error("💥 API ERROR:", err);

    return NextResponse.json(
      { error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

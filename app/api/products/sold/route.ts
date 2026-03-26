import { NextResponse } from "next/server";
import { query } from "@/lib/db";

/* ================= GET ================= */

export async function GET(req: Request) {
  try {
    /* ================= PARAM ================= */

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("product_id");

    if (!productId) {
      return NextResponse.json(
        { error: "MISSING_PRODUCT_ID" },
        { status: 400 }
      );
    }

    /* ================= VALIDATE ================= */

    // 🔥 chống query bậy / injection nhẹ
    if (!/^[0-9a-fA-F-]{36}$/.test(productId)) {
      return NextResponse.json(
        { error: "INVALID_PRODUCT_ID" },
        { status: 400 }
      );
    }

    /* ================= QUERY ================= */

    const { rows } = await query(
      `
      select coalesce(sum(quantity), 0)::int as sold
      from order_items
      where product_id = $1
      and status != 'cancelled'
      `,
      [productId]
    );

    const sold = rows[0]?.sold ?? 0;

    /* ================= RESPONSE ================= */

    return NextResponse.json({
      success: true,
      sold: Number(sold),
    });

  } catch (error) {
    console.error("❌ PRODUCT SOLD ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        sold: 0,
      },
      { status: 200 } // 🔥 tránh crash UI
    );
  }
}

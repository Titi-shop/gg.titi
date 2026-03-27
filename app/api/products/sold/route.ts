import { NextResponse } from "next/server";
import { getSoldByProduct } from "@/lib/db/products";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("product_id");

    if (!productId) {
      return NextResponse.json(
        { error: "MISSING_PRODUCT_ID" },
        { status: 400 }
      );
    }

    if (!/^[0-9a-fA-F-]{36}$/.test(productId)) {
      return NextResponse.json(
        { error: "INVALID_PRODUCT_ID" },
        { status: 400 }
      );
    }

    // 🔥 dùng DB layer
    const sold = await getSoldByProduct(productId);

    return NextResponse.json({
      success: true,
      sold,
    });

  } catch (error) {
    console.error("❌ PRODUCT SOLD ERROR:", error);

    return NextResponse.json(
      { success: false, sold: 0 },
      { status: 200 }
    );
  }
}

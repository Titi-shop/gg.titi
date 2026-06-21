import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import {
  getSellerAddresses,
  createSellerAddress,
} from "@/lib/db/sellerAddresses";

export const runtime = "nodejs";

/* ================= GET ================= */
export async function GET(req: Request) {
  try {
    const auth = await requireSeller();
    if (!auth.ok) return auth.response;

    const sellerId = auth.userId;

    const data = await getSellerAddresses(sellerId);

    return NextResponse.json(data);
  } catch (err) {
    console.error("[ADDRESSES GET ERROR]", err);

    return NextResponse.json(
      { error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/* ================= POST ================= */
export async function POST(req: Request) {
  try {
    const auth = await requireSeller();
    if (!auth.ok) return auth.response;

    const sellerId = auth.userId;

    const body = await req.json();

    const data = await createSellerAddress({
      ...body,
      seller_id: sellerId,
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("[ADDRESSES CREATE ERROR]", err);

    return NextResponse.json(
      { error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

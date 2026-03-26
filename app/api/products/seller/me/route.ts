import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { getSellerProducts } from "@/lib/db/products";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  // 🔥 map pi_uid → userId (uuid)
  const userRes = await query(
    `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
    [auth.user.pi_uid]
  );

  if (userRes.rowCount === 0) {
    return NextResponse.json(
      { error: "USER_NOT_FOUND" },
      { status: 404 }
    );
  }

  const userId = userRes.rows[0].id;

  // ✅ dùng UUID
  const products = await getSellerProducts(userId);

  return NextResponse.json(products);
}

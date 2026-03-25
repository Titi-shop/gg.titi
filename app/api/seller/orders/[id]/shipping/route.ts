/* =========================================================
   SELLER START SHIPPING
   PATCH /api/seller/orders/[id]/shipping
========================================================= */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { resolveRole } from "@/lib/auth/resolveRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    /* ================= AUTH ================= */

    const user = await getUserFromBearer();

    if (!user) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

     const userRes = await query(
  `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
  [user.pi_uid]
);

if (userRes.rowCount === 0) {
  return NextResponse.json(
    { error: "USER_NOT_FOUND" },
    { status: 404 }
  );
}

const userId = userRes.rows[0].id;
    /* ================= RBAC ================= */

    const role = await resolveRole(user);

    if (role !== "seller" && role !== "admin") {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    /* ================= UPDATE ITEM ================= */

    const { rowCount } = await query(
      `
      update order_items
      set
        status = 'shipping',
        shipped_at = now()
      where order_id = $1
      and seller_id = $2
      and status = 'confirmed'
      `,
      [params.id, userId]
    );

    if (!rowCount) {
      return NextResponse.json(
        { error: "NOTHING_UPDATED" },
        { status: 400 }
      );
    }

    /* ================= DONE ================= */

    return NextResponse.json({
      success: true,
      message: "ORDER_ITEMS_SHIPPING"
    });

  } catch (err) {
    console.error("❌ SHIPPING ERROR:", err);

    return NextResponse.json(
      { error: "FAILED" },
      { status: 500 }
    );
  }
}

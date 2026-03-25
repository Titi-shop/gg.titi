import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { resolveRole } from "@/lib/auth/resolveRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
GET /api/seller/orders/count
========================================================= */

export async function GET() {
  try {

    /* ================= AUTH ================= */

    const user = await getUserFromBearer();

    if (!user) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    const role = await resolveRole(user);

    if (role !== "seller" && role !== "admin") {
      return NextResponse.json(
        {
          pending: 0,
          confirmed: 0,
          shipping: 0,
          completed: 0,
          returned: 0,
          cancelled: 0,
        },
        { status: 200 }
      );
    }

    const userRes = await query(
  `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
  [user.pi_uid]
);

if (userRes.rowCount === 0) {
  return NextResponse.json(
    {
      pending: 0,
      confirmed: 0,
      shipping: 0,
      completed: 0,
      returned: 0,
      cancelled: 0,
    },
    { status: 200 }
  );
}

const userId = userRes.rows[0].id;
    /* ================= DATABASE ================= */

    const { rows } = await query(
      `
      select
        status,
        count(distinct order_id)::int as total
      from order_items
      where seller_id = $1
      group by status
      `,
      [userId]
    );

    const counts = {
      pending: 0,
      confirmed: 0,
      shipping: 0,
      completed: 0,
      returned: 0,
      cancelled: 0,
    };

    for (const r of rows) {
      if (r.status in counts) {
        counts[r.status as keyof typeof counts] =
          r.total;
      }
    }

    return NextResponse.json(counts);

  } catch (err) {

    console.error("SELLER ORDER COUNT ERROR:", err);

    return NextResponse.json(
      {
        pending: 0,
        confirmed: 0,
        shipping: 0,
        completed: 0,
        returned: 0,
        cancelled: 0,
      },
      { status: 200 }
    );
  }
}

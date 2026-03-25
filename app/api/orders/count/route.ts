import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPiToken } from "@/lib/piAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {

  try {

    /* ================= AUTH ================= */

    const auth = req.headers.get("authorization");

    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const token = auth.replace("Bearer ", "");

    const user = await verifyPiToken(token);

    if (!user) {
      return NextResponse.json(
        { error: "INVALID_TOKEN" },
        { status: 401 }
      );
    }

    const userRes = await query(
  `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
  [user.pi_uid]
);

if (userRes.rowCount === 0) {
  return NextResponse.json({
    pending: 0,
    pickup: 0,
    shipping: 0,
    completed: 0,
    cancelled: 0
  });
}

const userId = userRes.rows[0].id;

    /* ================= DATABASE ================= */

    const { rows } = await query(
      `
      select
  count(*) filter (where o.status='pending')::int as pending,
  count(*) filter (where o.status='pickup')::int as pickup,
  count(*) filter (where o.status='shipping')::int as shipping,

  count(distinct o.id) filter (
    where o.status='completed'
    and exists (
      select 1
      from order_items oi
      where oi.order_id = o.id
      and not exists (
        select 1
        from reviews r
        where r.order_item_id = oi.id
        and r.user_id = $1
      )
    )
  )::int as completed,

  count(*) filter (where o.status='cancelled')::int as cancelled

from orders o
where o.buyer_id = $1
      `,
       [userId]
    );

    return NextResponse.json(rows[0]);

  } catch (err) {

    console.error("ORDER COUNT ERROR:", err);

    return NextResponse.json(
      {
        pending: 0,
        pickup: 0,
        shipping: 0,
        completed: 0,
        cancelled: 0
      },
      { status: 200 }
    );
  }
}

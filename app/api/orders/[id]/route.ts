import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { query } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
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
    const { rows } = await query(
  `
  select
    o.id,
    o.total,
    o.status,
    o.created_at,

    json_agg(
      json_build_object(
        'product_id', oi.product_id,
        'product_name', oi.product_name,
        'thumbnail', oi.thumbnail,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'total_price', oi.total_price,
        'status', oi.status
      )
      order by oi.created_at asc
    ) as order_items

  from orders o
  join order_items oi on oi.order_id = o.id

  where o.id = $1
  and o.buyer_id = $2

  group by o.id
  `,
      [params.id, userId]
);
    const order = rows[0];

    if (!order) {
      return NextResponse.json(
        { error: "ORDER_NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(order);

  } catch (error) {

    console.error("GET ORDER ERROR:", error);

    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}

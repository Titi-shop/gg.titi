import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {

    const user = await getUserFromBearer(req);

    if (!user) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    const { rows } = await query(
`
select
  o.id,
  o.order_number,
  o.created_at,

  o.shipping_name,
  o.shipping_phone,
  o.shipping_address,
  o.shipping_provider,
  o.shipping_country,
  o.shipping_postal_code,

  coalesce(
    json_agg(
      json_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'product_name', oi.product_name,
        'thumbnail', coalesce(oi.thumbnail, ''),
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'total_price', oi.total_price,
        'status', oi.status,
        'tracking_code', oi.tracking_code,
        'seller_message', oi.seller_message
      )
      order by oi.created_at asc
    ) filter (where oi.id is not null),
    '[]'::json
  ) as order_items,

  coalesce(sum(oi.total_price),0) as total

from orders o

left join order_items oi
on oi.order_id = o.id
and oi.seller_id = $2

where o.id = $1

group by
  o.id,
  o.order_number,
  o.created_at,
  o.shipping_name,
  o.shipping_phone,
  o.shipping_address,
  o.shipping_provider,
  o.shipping_country,
  o.shipping_postal_code
`,
[params.id, user.pi_uid]
);

    if (!rows.length) {
  return NextResponse.json(
    { error: "Not found" },
    { status: 404 }
  );
}

const order = rows[0];

if (!Array.isArray(order.order_items)) {
  order.order_items = [];
}

return NextResponse.json(order);

  } catch (error) {

    console.error("SELLER ORDER ERROR:", error);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );

  }
}

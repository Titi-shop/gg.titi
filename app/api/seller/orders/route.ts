import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { resolveRole } from "@/lib/auth/resolveRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipping"
  | "completed"
  | "cancelled"
  | "returned";

function parseOrderStatus(v: string | null): OrderStatus | undefined {

  if (!v) return;

  const allowed: OrderStatus[] = [
    "pending",
    "confirmed",
    "shipping",
    "completed",
    "cancelled",
    "returned",
  ];

  return allowed.includes(v as OrderStatus)
    ? (v as OrderStatus)
    : undefined;
}

export async function GET(req: Request) {

  try {

    const user = await getUserFromBearer(req);

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
  return NextResponse.json([], { status: 200 });
}

const userId = userRes.rows[0].id;
    const role = await resolveRole(user);

    if (role !== "seller" && role !== "admin") {
      return NextResponse.json([], { status: 200 });
    }

    const { searchParams } = new URL(req.url);

    const status = parseOrderStatus(
      searchParams.get("status")
    );

    const page = Number(searchParams.get("page") ?? "1");
    const limit = 20;
    const offset = (page - 1) * limit;

    let statusFilter = "";

    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (status) {
      statusFilter = `and oi.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const limitIndex = paramIndex++;
    const offsetIndex = paramIndex++;

    params.push(limit);
    params.push(offset);

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

    json_agg(
      json_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'product_name', oi.product_name,
        'thumbnail', oi.thumbnail,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'total_price', oi.total_price,
        'status', oi.status
      )
      order by oi.created_at asc
    ) as order_items,

    sum(oi.total_price) as total

  from orders o
  join order_items oi
  on oi.order_id = o.id

  where oi.seller_id = $1
  ${statusFilter}

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

  order by o.created_at desc

  limit $${limitIndex}
  offset $${offsetIndex}
  `,
  params
);

    return NextResponse.json(rows);

  } catch (err) {

    console.error("SELLER ORDERS ERROR:", err);

    return NextResponse.json([], { status: 200 });

  }

}

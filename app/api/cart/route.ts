import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

/* ================= TYPES ================= */

type CartRow = {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;

  name: string | null;
  price: number | null;
  final_price: number | null;
  thumbnail: string | null;

  stock: number | null;
};

type CartInput = {
  product_id: string;
  variant_id?: string;
  quantity?: number;
};

/* ================= GET CART ================= */

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromBearer(req);

    if (!user?.pi_uid) {
      return NextResponse.json([]);
    }

    // 🔥 map → UUID
    const userRes = await query(
      `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
      [user.pi_uid]
    );

    if (userRes.rowCount === 0) {
      return NextResponse.json([]);
    }

    const userId = userRes.rows[0].id as string;

    const result = await query(
      `
      select 
        c.id,
        c.product_id,
        c.variant_id,
        c.quantity,

        p.name,
        p.price,
        p.thumbnail,
        p.stock

      from cart_items c
      left join products p on p.id = c.product_id

      where c.buyer_id = $1
      order by c.created_at desc
      `,
      [userId]
    );

    const rows = result.rows as CartRow[];

    const items = rows
      .filter((r) => r.product_id)
      .map((r) => ({
        id: r.variant_id
          ? `${r.product_id}-${r.variant_id}`
          : r.product_id,

        product_id: r.product_id,
        variant_id: r.variant_id,

        name: r.name ?? "Unknown product",

        price: Number(r.price ?? 0),
        sale_price: null,

        thumbnail: r.thumbnail ?? "",
        stock: r.stock ?? 0,
        quantity: r.quantity ?? 1,
      }));

    return NextResponse.json(items);
  } catch (err) {
    console.error("❌ CART GET ERROR:", err);
    return NextResponse.json([], { status: 500 });
  }
}

/* ================= ADD / UPDATE CART ================= */

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromBearer(req);

    if (!user?.pi_uid) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const items: CartInput[] = Array.isArray(body)
      ? body
      : [body];

    // 🔥 map → UUID
    const userRes = await query(
      `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
      [user.pi_uid]
    );

    if (userRes.rowCount === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const userId = userRes.rows[0].id as string;

    for (const item of items) {
      if (!item.product_id) continue;

      await query(
        `
        insert into cart_items (buyer_id, product_id, variant_id, quantity)
        values ($1, $2, $3, $4)
        on conflict (buyer_id, product_id, variant_id)
        do update set
          quantity = cart_items.quantity + excluded.quantity,
          updated_at = now()
        `,
        [
          userId,
          item.product_id,
          item.variant_id ?? null,
          item.quantity ?? 1,
        ]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ CART POST ERROR:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

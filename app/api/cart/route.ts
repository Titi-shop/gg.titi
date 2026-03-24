import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromBearer();

    if (!user) {
      return NextResponse.json({ items: [] });
    }

    const rows = await query(
      `
      select *
      from cart_items
      where user_id = $1
      order by created_at desc
      `,
      [user.pi_uid]
    );

    return NextResponse.json({ items: rows });
  } catch {
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}

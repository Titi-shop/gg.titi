import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { resolveRole } from "@/lib/auth/resolveRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  seller_message?: string;
};

export async function PATCH(
  req: Request,
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
    const role = await resolveRole(user);

    if (role !== "seller" && role !== "admin") {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    let body: Body = {};

    try {
      body = (await req.json()) as Body;
    } catch {}

    const sellerMessage =
      typeof body.seller_message === "string"
        ? body.seller_message.trim()
        : null;

    /* UPDATE ITEMS */

    const itemResult = await query(
      `
      update order_items
      set
        status='confirmed',
        seller_message=$3
      where
        order_id=$1
      and seller_id=$2
      and status='pending'
      `,
      [params.id, userId, sellerMessage]
    );

    if (!itemResult.rowCount) {
      return NextResponse.json(
        { error: "NOTHING_TO_CONFIRM" },
        { status: 400 }
      );
    }

    /* CHECK PENDING ITEMS */

    const { rows } = await query(
      `
      select count(*)::int as pending
      from order_items
      where order_id=$1
      and status='pending'
      `,
      [params.id]
    );

    if (rows[0].pending === 0) {
      await query(
        `
        update orders
        set status='pickup'
        where id=$1
        and status='pending'
        `,
        [params.id]
      );
    }

    return NextResponse.json({ success: true });

  } catch (err) {

    console.error("CONFIRM ORDER ERROR", err);

    return NextResponse.json(
      { error: "FAILED" },
      { status: 500 }
    );
  }
}

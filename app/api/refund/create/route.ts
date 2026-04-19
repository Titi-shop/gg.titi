import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { query } from "@/lib/db";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { returnId } = await req.json();

  /* ================= LOAD RETURN ================= */

  const { rows } = await query<{
    refund_amount: string;
    status: string;
    order_id: string;
  }>(
    `SELECT refund_amount, status, order_id
     FROM returns WHERE id = $1`,
    [returnId]
  );

  const ret = rows[0];

  if (!ret) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (ret.status !== "refund_pending") {
    return NextResponse.json({ error: "INVALID_STATE" }, { status: 400 });
  }

  /* ================= LOAD BUYER ================= */

  const { rows: orderRows } = await query<{
    buyer_pi_uid: string;
  }>(
    `SELECT buyer_pi_uid FROM orders WHERE id = $1`,
    [ret.order_id]
  );

  const buyerPiUid = orderRows[0]?.buyer_pi_uid;

  if (!buyerPiUid) {
    return NextResponse.json({ error: "NO_PI_UID" }, { status: 400 });
  }

  /* ================= CREATE PAYMENT ================= */

  const res = await fetch(`${PI_API}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Key ${PI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Number(ret.refund_amount),
      memo: `Refund ${returnId}`,
      uid: buyerPiUid,
      metadata: {
        type: "refund",
        return_id: returnId,
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("❌ CREATE REFUND ERROR", data);
    return NextResponse.json({ error: "PI_ERROR" }, { status: 400 });
  }

  /* ================= SAVE ================= */

  await query(
    `
    UPDATE returns
    SET refund_payment_id = $1
    WHERE id = $2
    `,
    [data.identifier, returnId]
  );

  return NextResponse.json({
    paymentId: data.identifier,
  });
}

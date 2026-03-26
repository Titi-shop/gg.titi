import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

export const dynamic = "force-dynamic";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

/* ================= SAFE QTY ================= */

function safeQuantity(v: unknown) {
  const n = Number(v);
  if (!Number.isInteger(n)) return 1;
  if (n < 1) return 1;
  if (n > 10) return 10;
  return n;
}

/* ================= POST ================= */

export async function POST(req: Request) {
  const client = await pool.connect();

  try {
    /* ================= BODY ================= */

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const paymentId = String((body as any).paymentId || "");
    const txid = String((body as any).txid || "");
    const productId = String((body as any).product_id || "");
    const quantity = safeQuantity((body as any).quantity);

    if (!paymentId || !txid || !productId) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    /* ================= AUTH ================= */

    const authUser = await getUserFromBearer(req);

    if (!authUser) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const pi_uid = authUser.pi_uid;

    /* ================= MAP USER ================= */

    const userRes = await client.query(
      `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
      [pi_uid]
    );

    if (userRes.rowCount === 0) {
      return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    }

    const userId = userRes.rows[0].id;

    /* ================= CHECK DUP ================= */

    const existing = await client.query(
      `select id from orders where pi_payment_id=$1 limit 1`,
      [paymentId]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json({
        success: true,
        order_id: existing.rows[0].id,
      });
    }

    /* ================= PRODUCT ================= */

    const productRes = await client.query(
      `select * from products where id = $1 limit 1`,
      [productId]
    );

    const product = productRes.rows[0];

    if (!product || product.is_active === false || product.deleted_at) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_AVAILABLE" },
        { status: 400 }
      );
    }

    /* ================= PRICE ================= */

    const unitPrice = Number(product.price);
    const total = Number((unitPrice * quantity).toFixed(6));

    /* ================= VERIFY PI ================= */

    const piRes = await fetch(`${PI_API}/payments/${paymentId}`, {
      headers: { Authorization: `Key ${PI_KEY}` },
      cache: "no-store",
    });

    if (!piRes.ok) {
      return NextResponse.json(
        { error: "PI_PAYMENT_NOT_FOUND" },
        { status: 400 }
      );
    }

    const payment = await piRes.json();

    if (payment.user_uid !== pi_uid) {
      return NextResponse.json(
        { error: "INVALID_PAYMENT_OWNER" },
        { status: 403 }
      );
    }

    if (payment.status !== "approved") {
      return NextResponse.json(
        { error: "PAYMENT_NOT_APPROVED" },
        { status: 400 }
      );
    }

    if (Math.abs(Number(payment.amount) - total) > 0.00001) {
      return NextResponse.json(
        { error: "INVALID_AMOUNT" },
        { status: 400 }
      );
    }

    /* ================= COMPLETE PI (QUAN TRỌNG NHẤT) ================= */

    console.log("COMPLETE START:", paymentId, txid);

    const completeRes = await fetch(
      `${PI_API}/payments/${paymentId}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ txid }),
      }
    );

    const completeData = await completeRes.json().catch(() => null);

    console.log("COMPLETE RESULT:", completeData);

    if (!completeRes.ok) {
      console.error("PI COMPLETE ERROR:", completeData);

      if (
        completeData?.error?.includes?.("already") ||
        completeData?.message?.includes?.("completed")
      ) {
        console.log("Already completed, continue...");
      } else {
        return NextResponse.json(
          { error: "PI_COMPLETE_FAILED" },
          { status: 400 }
        );
      }
    }

    console.log("COMPLETE DONE");

    /* ================= ADDRESS ================= */

    const addrRes = await client.query(
      `select * from addresses where user_id = $1 and is_default = true limit 1`,
      [userId]
    );

    const addr = addrRes.rows[0];

    if (!addr) {
      return NextResponse.json(
        { error: "NO_ADDRESS" },
        { status: 400 }
      );
    }

    /* ================= TRANSACTION ================= */

    await client.query("BEGIN");

    const stock = await client.query(
      `
      update products
      set stock = stock - $1,
          sold = sold + $1
      where id = $2
      and stock >= $1
      returning id
      `,
      [quantity, productId]
    );

    if (stock.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "OUT_OF_STOCK" }, { status: 400 });
    }

    const orderRes = await client.query(
      `
      insert into orders (
        order_number,
        buyer_id,
        pi_payment_id,
        pi_txid,
        total,
        shipping_name,
        shipping_phone,
        shipping_address
      )
      values (
        gen_random_uuid()::text,
        $1,$2,$3,$4,$5,$6,$7
      )
      returning id
      `,
      [
        userId,
        paymentId,
        txid,
        total,
        addr.full_name,
        addr.phone,
        addr.address_line,
      ]
    );

    const orderId = orderRes.rows[0].id;

    await client.query(
      `
      insert into order_items (
        order_id,
        product_id,
        seller_id,
        product_name,
        thumbnail,
        unit_price,
        quantity,
        total_price
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8)
      `,
      [
        orderId,
        product.id,
        product.seller_id,
        product.name,
        product.thumbnail ?? "",
        unitPrice,
        quantity,
        total,
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      order_id: orderId,
    });

  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error("COMPLETE ERROR:", err);

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

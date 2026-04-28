import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { withTransaction, query } from "@/lib/db";

export const runtime = "nodejs";

/* =========================
   TYPES
========================= */

type SubmitBody = {
  payment_intent_id: string;
  txid: string;
  pi_payment_id: string;
};

/* =========================
   HELPERS
========================= */

function isUUID(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f-]{36}$/i.test(v);
}

/* =========================
   MOCK VERIFY (replace later)
========================= */

async function verifyPi(pi_payment_id: string) {
  return {
    ok: true,
    amount: 10,
    raw: {}
  };
}

async function verifyRpc(txid: string) {
  return {
    ok: true,
    receiver: process.env.PI_MERCHANT_WALLET as string,
    amount: 10,
    raw: {}
  };
}

/* =========================
   API
========================= */

export async function POST(req: Request) {
  try {
    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;

    const body = (await req.json()) as SubmitBody;

    if (!isUUID(body.payment_intent_id)) {
      return NextResponse.json({ error: "INVALID_INTENT" }, { status: 400 });
    }

    console.log("[PAYMENT][SUBMIT] START", { userId });

    const result = await withTransaction(async (client) => {

      /* =========================
         LOCK INTENT
      ========================= */

      const intentRes = await client.query(
        `
        SELECT *
        FROM payment_intents
        WHERE id = $1 AND buyer_id = $2
        FOR UPDATE
        `,
        [body.payment_intent_id, userId]
      );

      if (!intentRes.rows.length) {
        throw new Error("NOT_FOUND");
      }

      const intent = intentRes.rows[0];

      /* =========================
         IDEMPOTENCY CHECK
      ========================= */

      if (intent.status === "paid") {
        return { ok: true, already: true };
      }

      /* =========================
         VERIFY PI
      ========================= */

      const pi = await verifyPi(body.pi_payment_id);

      if (!pi.ok) {
        throw new Error("PI_FAILED");
      }

      /* =========================
         VERIFY RPC
      ========================= */

      const rpc = await verifyRpc(body.txid);

      if (!rpc.ok) {
        throw new Error("RPC_FAILED");
      }

      /* =========================
         VERIFY AMOUNT
      ========================= */

      if (Number(pi.amount) !== Number(intent.total_amount)) {
        throw new Error("AMOUNT_MISMATCH");
      }

      /* =========================
         INSERT RPC LOG
      ========================= */

      await client.query(
        `
        INSERT INTO rpc_verification_logs (
          payment_intent_id,
          txid,
          verified,
          reason,
          payload
        )
        VALUES ($1,$2,$3,$4,$5)
        `,
        [
          intent.id,
          body.txid,
          true,
          null,
          JSON.stringify(rpc.raw)
        ]
      );

      /* =========================
         UPDATE PI PAYMENTS
      ========================= */

      await client.query(
        `
        UPDATE pi_payments
        SET status = 'verified',
            txid = $2
        WHERE pi_payment_id = $1
        `,
        [body.pi_payment_id, body.txid]
      );

      /* =========================
         UPDATE INTENT
      ========================= */

      await client.query(
        `
        UPDATE payment_intents
        SET status = 'paid',
            txid = $2,
            pi_payment_id = $3,
            paid_at = now()
        WHERE id = $1
        `,
        [intent.id, body.txid, body.pi_payment_id]
      );

      /* =========================
         CREATE ORDER (atomic)
      ========================= */

      const order = await client.query(
        `
        INSERT INTO orders (
          buyer_id,
          seller_id,
          total_amount,
          status
        )
        VALUES ($1,$2,$3,'paid')
        RETURNING id
        `,
        [
          intent.buyer_id,
          intent.seller_id,
          intent.total_amount
        ]
      );

      return {
        ok: true,
        order_id: order.rows[0].id
      };
    });

    return NextResponse.json(result);

  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "SUBMIT_FAILED" },
      { status: 400 }
    );
  }
}

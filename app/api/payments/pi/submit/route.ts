import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;
const PI_HORIZON = process.env.PI_HORIZON_URL!;
const MERCHANT_WALLET = process.env.PI_MERCHANT_WALLET!;

/* =========================
   TYPES
========================= */

type SubmitBody = {
  payment_intent_id?: unknown;
  txid?: unknown;
  pi_payment_id?: unknown;
};

type PiPaymentVerify = {
  identifier: string;
  amount: number;
  status: {
    developer_approved: boolean;
    transaction_verified: boolean;
    developer_completed: boolean;
    cancelled: boolean;
    user_cancelled: boolean;
  };
  transaction?: {
    txid?: string;
  };
};

type RpcVerify = {
  ok: boolean;
  amount: number;
  receiver: string;
  raw: unknown;
};

/* =========================
   HELPERS
========================= */

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

/* =========================
   PI PLATFORM VERIFY
========================= */

async function verifyPiPayment(piPaymentId: string): Promise<PiPaymentVerify> {
  console.log("🟡 [PI_VERIFY] FETCH_PI_PAYMENT", piPaymentId);

  const res = await fetch(`${PI_API}/payments/${piPaymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Key ${PI_KEY}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();

  console.log("🟡 [PI_VERIFY] PI_STATUS", res.status);

  if (!res.ok) {
    console.error("❌ [PI_VERIFY] PI_FETCH_FAILED", text);
    throw new Error("PI_FETCH_FAILED");
  }

  const data = JSON.parse(text) as PiPaymentVerify;

  console.log("🟢 [PI_VERIFY] PI_DATA", {
    identifier: data.identifier,
    amount: data.amount,
    approved: data.status?.developer_approved,
    completed: data.status?.developer_completed,
  });

  return data;
}

/* =========================
   PI COMPLETE
========================= */

async function completePiPayment(piPaymentId: string, txid: string) {
  console.log("🟡 [PI_COMPLETE] CALL_PI_COMPLETE", { piPaymentId, txid });

  const res = await fetch(`${PI_API}/payments/${piPaymentId}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Key ${PI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ txid }),
    cache: "no-store",
  });

  const text = await res.text();

  console.log("🟡 [PI_COMPLETE] PI_STATUS", res.status);

  if (!res.ok) {
    console.error("❌ [PI_COMPLETE] PI_COMPLETE_FAILED", text);
    throw new Error("PI_COMPLETE_FAILED");
  }

  console.log("🟢 [PI_COMPLETE] SUCCESS");
}

/* =========================
   RPC VERIFY BLOCKCHAIN
========================= */

async function verifyRpc(txid: string): Promise<RpcVerify> {
  console.log("🟡 [RPC_VERIFY] FETCH_TX", txid);

  const res = await fetch(`${PI_HORIZON}/transactions/${txid}`, {
    method: "GET",
    cache: "no-store",
  });

  const text = await res.text();

  console.log("🟡 [RPC_VERIFY] HORIZON_STATUS", res.status);

  if (!res.ok) {
    console.error("❌ [RPC_VERIFY] TX_NOT_FOUND", text);
    return {
      ok: false,
      amount: 0,
      receiver: "",
      raw: text,
    };
  }

  const data = JSON.parse(text);

  /* NOTE:
     Horizon raw decode payment ops separately if needed.
     Tạm production simple verify tx exists.
     Nếu muốn strict parse operation mình viết bước sau.
  */

  return {
    ok: true,
    amount: Number(data.memo || 0), // placeholder if memo encoded amount not used
    receiver: MERCHANT_WALLET,
    raw: data,
  };
}

/* =========================
   API
========================= */

export async function POST(req: Request) {
  try {
    console.log("🟡 [PAYMENT_SUBMIT] START");

    const auth = await getUserFromBearer();

    if (!auth) {
      console.error("❌ [PAYMENT_SUBMIT] UNAUTHORIZED");
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;

    console.log("🟢 [PAYMENT_SUBMIT] AUTH_OK", { userId });

    const raw = await req.json().catch(() => null);

    if (!raw || typeof raw !== "object") {
      console.error("❌ [PAYMENT_SUBMIT] INVALID_BODY");
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const body = raw as SubmitBody;

    const paymentIntentId =
      typeof body.payment_intent_id === "string" ? body.payment_intent_id.trim() : "";

    const txid =
      typeof body.txid === "string" ? body.txid.trim() : "";

    const piPaymentId =
      typeof body.pi_payment_id === "string" ? body.pi_payment_id.trim() : "";

    console.log("🟡 [PAYMENT_SUBMIT] BODY", {
      paymentIntentId,
      txid,
      piPaymentId,
    });

    if (!isUUID(paymentIntentId)) {
      console.error("❌ [PAYMENT_SUBMIT] INVALID_INTENT");
      return NextResponse.json({ error: "INVALID_INTENT" }, { status: 400 });
    }

    if (!txid) {
      console.error("❌ [PAYMENT_SUBMIT] INVALID_TXID");
      return NextResponse.json({ error: "INVALID_TXID" }, { status: 400 });
    }

    if (!piPaymentId) {
      console.error("❌ [PAYMENT_SUBMIT] INVALID_PI_PAYMENT_ID");
      return NextResponse.json({ error: "INVALID_PI_PAYMENT_ID" }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      console.log("🟡 [PAYMENT_SUBMIT] LOCK_INTENT");

      const intentRes = await client.query(
        `
        SELECT *
        FROM payment_intents
        WHERE id = $1 AND buyer_id = $2
        FOR UPDATE
        `,
        [paymentIntentId, userId]
      );

      if (!intentRes.rows.length) {
        throw new Error("INTENT_NOT_FOUND");
      }

      const intent = intentRes.rows[0];

      console.log("🟢 [PAYMENT_SUBMIT] INTENT_FOUND", {
        id: intent.id,
        status: intent.status,
        total: intent.total_amount,
      });

      if (intent.status === "paid") {
        console.log("🟢 [PAYMENT_SUBMIT] ALREADY_PAID");
        return { ok: true, already: true, order_id: intent.order_id ?? null };
      }

      /* ================= PI VERIFY ================= */

      const pi = await verifyPiPayment(piPaymentId);

      if (!pi.status?.developer_approved) {
        throw new Error("PI_NOT_APPROVED");
      }

      /* ================= RPC VERIFY ================= */

      const rpc = await verifyRpc(txid);

      if (!rpc.ok) {
        throw new Error("RPC_FAILED");
      }

      /* ================= AMOUNT CHECK ================= */

      if (Number(pi.amount) !== Number(intent.total_amount)) {
        console.error("❌ [PAYMENT_SUBMIT] AMOUNT_MISMATCH", {
          piAmount: pi.amount,
          intentAmount: intent.total_amount,
        });
        throw new Error("AMOUNT_MISMATCH");
      }

      /* ================= COMPLETE PI ================= */

      await completePiPayment(piPaymentId, txid);

      /* ================= UPDATE INTENT ================= */

      await client.query(
        `
        UPDATE payment_intents
        SET
          pi_payment_id = $2,
          txid = $3,
          status = 'paid',
          paid_at = now(),
          updated_at = now()
        WHERE id = $1
        `,
        [intent.id, piPaymentId, txid]
      );

      console.log("🟢 [PAYMENT_SUBMIT] INTENT_PAID");

      /* ================= CREATE ORDER ================= */

      const orderRes = await client.query<{ id: string }>(
        `
        INSERT INTO orders (
          buyer_id,
          seller_id,
          total_amount,
          status
        )
        VALUES ($1,$2,$3,'pending')
        RETURNING id
        `,
        [
          intent.buyer_id,
          intent.seller_id,
          intent.total_amount,
        ]
      );

      const orderId = orderRes.rows[0].id;

      console.log("🟢 [PAYMENT_SUBMIT] ORDER_CREATED", orderId);

      await client.query(
        `
        UPDATE payment_intents
        SET order_id = $2
        WHERE id = $1
        `,
        [intent.id, orderId]
      );

      return {
        ok: true,
        order_id: orderId,
      };
    });

    console.log("🟢 [PAYMENT_SUBMIT] SUCCESS", result);

    return NextResponse.json(result);

  } catch (e) {
    console.error("🔥 [PAYMENT_SUBMIT] CRASH", e);

    return NextResponse.json(
      { error: (e as Error).message || "SUBMIT_FAILED" },
      { status: 400 }
    );
  }
}

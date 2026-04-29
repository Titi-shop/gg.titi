// app/api/payments/pi/authorize/route.ts

import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { withTransaction } from "@/lib/db";
import {
  verifyPiUser,
  fetchPiPayment,
  bindPiPaymentToIntent,
} from "@/lib/db/payments.verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = ["hkg1", "sin1"];

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

/* =========================
   TYPES
========================= */

type Body = {
  payment_intent_id?: unknown;
  pi_payment_id?: unknown;
};

/* =========================
   HELPERS
========================= */

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

async function callPiApprove(piPaymentId: string) {
  console.log("🟡 [PI_AUTHORIZE] CALL_PI_APPROVE", piPaymentId);

  const res = await fetch(`${PI_API}/payments/${piPaymentId}/approve`, {
    method: "POST",
    headers: {
      Authorization: `Key ${PI_KEY}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const raw = await res.text();

  console.log("🟡 [PI_AUTHORIZE] PI_APPROVE_STATUS", res.status);
  console.log("🟡 [PI_AUTHORIZE] PI_APPROVE_BODY", raw);

  if (!res.ok) {
    throw new Error("PI_APPROVE_FAILED");
  }

  return true;
}

/* =========================
   API
========================= */

export async function POST(req: Request) {
  try {
    console.log("🟡 [PI_AUTHORIZE] START");

    /* ================= AUTH ================= */

    const auth = await getUserFromBearer();

    if (!auth) {
      console.error("❌ [PI_AUTHORIZE] UNAUTHORIZED");
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;

    console.log("🟢 [PI_AUTHORIZE] AUTH_OK", { userId });

    /* ================= BODY ================= */

    const raw = await req.json().catch(() => null);

    console.log("🟡 [PI_AUTHORIZE] RAW_BODY", raw);

    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const body = raw as Body;

    const paymentIntentId =
      typeof body.payment_intent_id === "string"
        ? body.payment_intent_id.trim()
        : "";

    const piPaymentId =
      typeof body.pi_payment_id === "string"
        ? body.pi_payment_id.trim()
        : "";

    console.log("🟡 [PI_AUTHORIZE] BODY_PARSED", {
      paymentIntentId,
      piPaymentId,
    });

    if (!isUUID(paymentIntentId)) {
      console.error("❌ [PI_AUTHORIZE] INVALID_PAYMENT_INTENT");
      return NextResponse.json(
        { error: "INVALID_PAYMENT_INTENT" },
        { status: 400 }
      );
    }

    if (!piPaymentId) {
      console.error("❌ [PI_AUTHORIZE] INVALID_PI_PAYMENT_ID");
      return NextResponse.json(
        { error: "INVALID_PI_PAYMENT_ID" },
        { status: 400 }
      );
    }

    /* ================= VERIFY PI USER TOKEN ================= */

    const piUid = await verifyPiUser(req.headers.get("authorization") || "");

    console.log("🟢 [PI_AUTHORIZE] PI_USER_OK", { piUid });

    /* ================= FETCH PI PAYMENT ================= */

    const payment = await fetchPiPayment(piPaymentId);

    console.log("🟢 [PI_AUTHORIZE] PI_PAYMENT_FETCHED", {
      amount: payment.amount,
      user_uid: payment.user_uid,
      developer_approved: payment.status?.developer_approved,
      txid: payment.transaction?.txid ?? null,
    });

    if (String(payment.user_uid) !== String(piUid)) {
      console.error("❌ [PI_AUTHORIZE] PI_USER_MISMATCH", {
        payment_user_uid: payment.user_uid,
        expected_pi_uid: piUid,
      });

      return NextResponse.json({ error: "PI_USER_MISMATCH" }, { status: 400 });
    }

    /* ================= DB BIND PAYMENT ================= */

if (!bindPiPaymentToIntent) {
  throw new Error("DB_FUNCTION_MISSING_BIND_PI_PAYMENT");
}

const bindResult = await withTransaction(async (client) => {
  return await bindPiPaymentToIntent(client, {
    userId,
    paymentIntentId,
    piPaymentId,
    piUid,
    verifiedAmount: Number(payment.amount),
    piPayload: payment,
  });
});

    console.log("🟢 [PI_AUTHORIZE] DB_BIND_OK", bindResult);

    /* ================= PI APPROVE ================= */

    if (!payment.status?.developer_approved) {
      await callPiApprove(piPaymentId);
    } else {
      console.warn("🟡 [PI_AUTHORIZE] PI_ALREADY_APPROVED");
    }

    console.log("🟢 [PI_AUTHORIZE] SUCCESS");

    return NextResponse.json({
      success: true,
      payment_intent_id: paymentIntentId,
      pi_payment_id: piPaymentId,
    });
  } catch (err) {
    console.error("🔥 [PI_AUTHORIZE] CRASH", err);

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "AUTHORIZE_FAILED",
      },
      { status: 400 }
    );
  }
}

import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { processPiPayment } from "@/lib/db/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

/* ================= HELPERS ================= */

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

/* ================= TYPES ================= */

type Body = {
  paymentId?: unknown;
  txid?: unknown;
};

/* ================= API ================= */

export async function POST(req: Request) {
  try {
    /* ================= BODY ================= */

    const raw = await req.json().catch(() => null);

    if (!raw || typeof raw !== "object") {
      console.error("❌ [API] INVALID_BODY_RAW", raw);
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const body = raw as Body;

    const paymentId =
      typeof body.paymentId === "string" ? body.paymentId : "";

    const txid =
      typeof body.txid === "string" ? body.txid : "";

    console.log("🟡 [API] STEP 1 BODY", { paymentId, txid });

    if (!paymentId || !txid) {
      console.error("❌ [API] MISSING_PAYMENT_OR_TXID");
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    /* ================= AUTH ================= */

    const auth = await getUserFromBearer();

    if (!auth) {
      console.error("❌ [API] UNAUTHORIZED");
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;
    /* ================= VERIFY PI USER ================= */

console.log("🟡 [API] STEP 2.5 VERIFY PI USER");

const meRes = await fetch("https://api.minepi.com/v2/me", {
  headers: {
    Authorization: req.headers.get("authorization") || "",
  },
  cache: "no-store",
});

if (!meRes.ok) {
  console.error("❌ [API] INVALID_PI_TOKEN");
  return NextResponse.json(
    { error: "INVALID_TOKEN" },
    { status: 401 }
  );
}

const me = await meRes.json();

if (!me?.uid) {
  console.error("❌ [API] INVALID_PI_USER", me);
  return NextResponse.json(
    { error: "INVALID_PI_USER" },
    { status: 401 }
  );
}

const piUidFromToken = me.uid;

console.log("🟢 [API] STEP 2.6 PI USER OK", {
  piUidFromToken,
});

    /* ================= VERIFY PI ================= */

    const piRes = await fetch(`${PI_API}/payments/${paymentId}`, {
      headers: { Authorization: `Key ${PI_KEY}` },
      cache: "no-store",
    });

    if (!piRes.ok) {
      console.error("❌ [API] PI_PAYMENT_NOT_FOUND", paymentId);
      return NextResponse.json(
        { error: "PI_PAYMENT_NOT_FOUND" },
        { status: 400 }
      );
    }

    const payment = await piRes.json();

    console.log("🟢 [API] STEP 3 PI FETCHED", {
      amount: payment.amount,
      status: payment.status,
    });

    if (!payment.amount || Number(payment.amount) <= 0) {
      console.error("❌ [API] INVALID_AMOUNT_FROM_PI", payment.amount);
      return NextResponse.json(
        { error: "INVALID_AMOUNT" },
        { status: 400 }
      );
    }

    /* ================= VERIFY USER ================= */

    if (payment.user_uid !== piUidFromToken) {
      console.error("❌ [API] USER_MISMATCH", {
        pi: payment.user_uid,
        token: piUidFromToken,
      });

      return NextResponse.json(
        { error: "INVALID_USER_PAYMENT" },
        { status: 400 }
      );
    }

    console.log("🟢 [API] STEP 4 USER OK");

    /* ================= VERIFY TXID ================= */

    if (payment.transaction?.txid !== txid) {
      console.error("❌ [API] TXID_MISMATCH", {
        pi: payment.transaction?.txid,
        client: txid,
      });

      return NextResponse.json(
        { error: "INVALID_TXID" },
        { status: 400 }
      );
    }

    console.log("🟢 [API] STEP 5 TXID OK");

    /* ================= VERIFY STATUS ================= */

    const status = payment.status;

    if (
      !status?.developer_approved ||
      !status?.transaction_verified
    ) {
      console.error("❌ [API] PAYMENT_NOT_APPROVED", status);

      return NextResponse.json(
        { error: "PAYMENT_NOT_APPROVED" },
        { status: 400 }
      );
    }

    console.log("🟢 [API] STEP 6 STATUS OK");

    /* ================= METADATA ================= */

    const meta = payment.metadata || {};

    const productId =
      typeof meta.product_id === "string" ? meta.product_id : "";

    const variantId =
      typeof meta.variant_id === "string" ? meta.variant_id : null;

    const quantity =
      Number.isInteger(meta.quantity) &&
      meta.quantity > 0 &&
      meta.quantity <= 10
        ? meta.quantity
        : 1;

    if (!productId || !isUUID(productId)) {
      console.error("❌ [API] INVALID_METADATA_PRODUCT", productId);
      return NextResponse.json(
        { error: "INVALID_METADATA_PRODUCT" },
        { status: 400 }
      );
    }

    if (variantId && !isUUID(variantId)) {
      console.error("❌ [API] INVALID_VARIANT_ID", variantId);
      return NextResponse.json(
        { error: "INVALID_VARIANT_ID" },
        { status: 400 }
      );
    }

    console.log("🟢 [API] STEP 7 METADATA OK", {
      productId,
      variantId,
      quantity,
    });

    /* ================= COMPLETE PI ================= */

    if (!status?.developer_completed) {
      console.log("🟡 [API] STEP 8 COMPLETE_PI");

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

      if (!completeRes.ok) {
        console.warn("🟡 [API] PI_COMPLETE_WARNING", completeData);

        const isAlreadyCompleted =
          completeData?.error === "already_completed" ||
          completeData?.error_message?.includes("already");

        if (!isAlreadyCompleted) {
          return NextResponse.json(
            { error: "PI_COMPLETE_FAILED" },
            { status: 400 }
          );
        }

        console.log("🟢 [API] ALREADY COMPLETED → CONTINUE");
      }
    }

    /* ================= DB ================= */

    console.log("🟡 [API] STEP 9 CALL DB");

    const result = await processPiPayment({
      userId,
      paymentId,
      txid,
      productId,
      variantId,
      quantity,
      verifiedAmount: Number(payment.amount),
    });

    console.log("🟢 [API] STEP 10 SUCCESS", result);

    return NextResponse.json({
      success: true,
      order_id: result.orderId,
    });

  } catch (err) {
    console.error("🔥 [API COMPLETE ERROR]", err);

    return NextResponse.json(
      { error: (err as Error).message || "PAYMENT_FAILED" },
      { status: 400 }
    );
  }
}

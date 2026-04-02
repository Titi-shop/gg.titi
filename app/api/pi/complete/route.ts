import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { processPiPayment } from "@/lib/db/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

/* =========================================================
   HELPERS
========================================================= */

function isUUID(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

function safeQuantity(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n)) return 1;
  if (n < 1) return 1;
  if (n > 10) return 10;
  return n;
}

/* =========================================================
   TYPES
========================================================= */

type Body = {
  paymentId?: unknown;
  txid?: unknown;
  product_id?: unknown;
  quantity?: unknown;

  shipping?: {
    country?: string;
  };

  selectedRegion?: unknown;
};

/* =========================================================
   API
========================================================= */

export async function POST(req: Request) {
  try {
    console.log("🟡 [PAYMENT][COMPLETE] START");

    /* ================= BODY ================= */

    const raw = await req.json().catch(() => null);

    if (!raw || typeof raw !== "object") {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const body = raw as Body;

    const paymentId =
      typeof body.paymentId === "string" ? body.paymentId : "";

    const txid =
      typeof body.txid === "string" ? body.txid : "";

    const productId =
      typeof body.product_id === "string" ? body.product_id : "";

    const quantity = safeQuantity(body.quantity);

    const selectedRegion =
      typeof body.selectedRegion === "string"
        ? body.selectedRegion
        : "";

    console.log("🟢 [PAYMENT][COMPLETE] PARSED", {
      hasPaymentId: !!paymentId,
      hasTxid: !!txid,
      productId,
      quantity,
      selectedRegion,
    });

    /* ================= VALIDATE ================= */

    if (!paymentId || !txid || !productId) {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    if (!isUUID(productId)) {
      console.log("🔴 INVALID PRODUCT UUID:", productId);

      return NextResponse.json(
        { error: "INVALID_PRODUCT_ID" },
        { status: 400 }
      );
    }

    /* ================= AUTH ================= */

    const authUser = await getUserFromBearer(req);

    if (!authUser) {
      console.log("🔴 [PAYMENT][COMPLETE] UNAUTHORIZED");

      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const pi_uid = authUser.pi_uid;

    console.log("🟢 [PAYMENT][COMPLETE] USER OK");

    /* ================= VERIFY PI ================= */

    console.log("🟡 [PAYMENT][COMPLETE] VERIFY PI");

    const piRes = await fetch(`${PI_API}/payments/${paymentId}`, {
      headers: { Authorization: `Key ${PI_KEY}` },
      cache: "no-store",
    });

    if (!piRes.ok) {
      console.log("🔴 PI PAYMENT NOT FOUND");

      return NextResponse.json(
        { error: "PI_PAYMENT_NOT_FOUND" },
        { status: 400 }
      );
    }

    const payment = await piRes.json();

    if (payment.user_uid !== pi_uid) {
      console.log("🔴 INVALID PAYMENT OWNER");

      return NextResponse.json(
        { error: "INVALID_PAYMENT_OWNER" },
        { status: 403 }
      );
    }

    if (payment.status !== "approved") {
      console.log("🔴 PAYMENT NOT APPROVED");

      return NextResponse.json(
        { error: "PAYMENT_NOT_APPROVED" },
        { status: 400 }
      );
    }

    console.log("🟢 PI VERIFIED");

    /* ================= COMPLETE PI ================= */

    console.log("🟡 [PAYMENT][COMPLETE] COMPLETE PI");

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
      if (
        completeData?.error?.includes?.("already") ||
        completeData?.message?.includes?.("completed")
      ) {
        console.log("🟡 ALREADY COMPLETED");
      } else {
        console.log("🔴 PI COMPLETE FAILED");

        return NextResponse.json(
          { error: "PI_COMPLETE_FAILED" },
          { status: 400 }
        );
      }
    }

    console.log("🟢 PI COMPLETED");

    /* ================= DB PROCESS ================= */

    console.log("🟡 [ORDER] CREATE");

    const result = await processPiPayment({
      piUid: pi_uid,
      productId,
      quantity,
      paymentId,
      txid,
    });

    console.log("🟢 [ORDER] DONE", {
      orderId: result.orderId,
      duplicated: result.duplicated,
    });

    return NextResponse.json({
      success: true,
      order_id: result.orderId,
    });

  } catch (err) {
    console.error("🔥 [PAYMENT][COMPLETE] ERROR", err);

    return NextResponse.json(
      { error: "PAYMENT_FAILED" },
      { status: 400 }
    );
  }
}

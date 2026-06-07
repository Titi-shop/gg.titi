import { markPaymentVerifying } from "@/lib/db/payments.submit";

import type { SubmitPaymentBody } from "@/lib/payments/payment.types";

/* =========================================================
   TYPES
========================================================= */

type SubmitRequestInput = {
  userId: string;
  raw: unknown;
  requestId: string;
};

/* =========================================================
   HELPERS
========================================================= */

function isUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeSubmitBody(raw: unknown): SubmitPaymentBody {
  if (!isRecord(raw)) {
    throw new Error("INVALID_BODY");
  }

  const paymentIntentId =
    typeof raw.payment_intent_id === "string"
      ? raw.payment_intent_id.trim()
      : "";

  const piPaymentId =
    typeof raw.pi_payment_id === "string"
      ? raw.pi_payment_id.trim()
      : "";

  const txid =
    typeof raw.txid === "string"
      ? raw.txid.trim()
      : "";

  if (!isUUID(paymentIntentId)) {
    throw new Error("INVALID_PAYMENT_INTENT_ID");
  }

  if (!piPaymentId) {
    throw new Error("INVALID_PI_PAYMENT_ID");
  }

  if (!txid) {
    throw new Error("INVALID_TXID");
  }

  return {
    payment_intent_id: paymentIntentId,
    pi_payment_id: piPaymentId,
    txid,
  };
}

/* =========================================================
   MAIN SERVICE
========================================================= */

export async function submitPiPaymentFromRequest({
  userId,
  raw,
  requestId,
}: SubmitRequestInput) {
  const body = normalizeSubmitBody(raw);

  console.log("[PAYMENT][SUBMIT_START]", {
    requestId,
    paymentIntentId: body.payment_intent_id,
    piPaymentId: body.pi_payment_id,
  });

  await markPaymentVerifying({
    paymentIntentId: body.payment_intent_id,
    userId,
    piPaymentId: body.pi_payment_id,
    txid: body.txid,
  });

  console.log("[PAYMENT][SUBMIT_VERIFYING_LOCKED]", {
    requestId,
    paymentIntentId: body.payment_intent_id,
  });

  return {
    success: true,
    requestId,
    status: "processing",
    payment_intent_id: body.payment_intent_id,
  };
}

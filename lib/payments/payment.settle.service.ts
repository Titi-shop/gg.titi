import { submitPiPaymentFromRequest } from "./payment.submit.service";
import { runPaymentSettlement } from "@/lib/payments/payment.orchestrator";
import { getPaymentIntent } from "@/lib/db/payments.intent";

/* =========================================================
   TYPES
========================================================= */

type SettleRawInput = {
  payment_intent_id?: unknown;
  pi_payment_id?: unknown;
  txid?: unknown;
};

type Input = {
  raw: SettleRawInput;
  userId: string;
  requestId: string;
};

/* =========================================================
   SERVICE
========================================================= */

export async function settlePiPayment({
  raw,
  userId,
  requestId,
}: Input) {
  /**
   * 1. Submit step (idempotent, no settlement side-effect)
   */
  await submitPiPaymentFromRequest({
    raw,
    userId,
    requestId,
  });

  /**
   * 2. Strict input validation
   */
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

  if (!paymentIntentId || !piPaymentId || !txid) {
    throw new Error("INVALID_SETTLEMENT_INPUT");
  }

  /**
   * 3. Load intent (service layer allowed)
   */
  const intent = await getPaymentIntent(paymentIntentId);

  if (!intent) {
    throw new Error("INTENT_NOT_FOUND");
  }

  /**
   * 4. Call orchestrator (core domain logic)
   */
  const result = await runPaymentSettlement({
    paymentIntentId,
    piPaymentId,
    txid,
    userId,
    source: "submit-api",
    intent,
  });

  if (!result.ok) {
    throw new Error("SETTLEMENT_FAILED");
  }

  return {
    success: result.ok,
    requestId,
    order_id: result.orderId,
    amount: result.amount,
    pi_completed: result.piCompleted,
    rpc_audited: result.rpcAudited,
    source: result.source,
  };
}

import {
  piGetMe,
  piGetPayment,
  piApprovePayment,
} from "@/lib/pi/client";

import {
  getPaymentIntent,
} from "@/lib/db/payments.intent";

import {
  bindPiPaymentToIntent,
} from "@/lib/db/payments.bind";


import type {
  PaymentIntentStatus,
} from "@/lib/payments/types";
/* =========================================================
   HELPERS
========================================================= */

function vlog(
  step: string,
  data?: unknown
) {
  console.log(
    `[PAYMENT][AUTHORIZE_V6][${step}]`,
    data ?? ""
  );
}

function normalizeString(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isValidIntentState(
  status: unknown
): boolean {
  if (typeof status !== "string") {
    return false;
  }

  return [
    "created",
    "authorized",
    "submitted",
    "pending_settlement",
  ].includes(status);
}

/* =========================================================
   AUTHORIZE SERVICE
========================================================= */

export async function piAuthorizePayment({
  userId,
  authorizationHeader,
  body,
}: Input): Promise<{
  success: true;
}> {
  vlog("START", {
    userId,
    body,
  });

  /* =====================================================
     1. NORMALIZE INPUT
  ===================================================== */

  const paymentIntentId =
    normalizeString(
      body.paymentIntentId ??
        body.payment_intent_id
    );

  const piPaymentId =
    normalizeString(
      body.piPaymentId ??
        body.pi_payment_id
    );

  if (
    !paymentIntentId ||
    !piPaymentId
  ) {
    throw new Error(
      "INVALID_INPUT"
    );
  }

  vlog("INPUT_OK", {
    paymentIntentId,
    piPaymentId,
  });

  /* =====================================================
     2. LOAD PAYMENT INTENT
  ===================================================== */

  const intent =
    await getPaymentIntent(
      paymentIntentId
    );

  if (!intent) {
    throw new Error(
      "INTENT_NOT_FOUND"
    );
  }

  vlog("INTENT_OK", {
    id: intent.id,
    status: intent.status,
    buyer_id:
      intent.buyer_id,
    total_amount:
      intent.total_amount,
  });

  /* =====================================================
     3. VERIFY OWNER
  ===================================================== */

  if (
    intent.buyer_id !== userId
  ) {
    throw new Error(
      "INTENT_OWNER_MISMATCH"
    );
  }

  /* =====================================================
     4. VERIFY STATE MACHINE
  ===================================================== */

  if (
    !isValidIntentState(
      intent.status
    )
  ) {
    throw new Error(
      "INVALID_INTENT_STATE"
    );
  }

  /* =====================================================
     5. PREVENT RE-BIND
  ===================================================== */

  if (
    intent.pi_payment_id &&
    intent.pi_payment_id !==
      piPaymentId
  ) {
    throw new Error(
      "PI_PAYMENT_ALREADY_BOUND"
    );
  }

  /* =====================================================
     6. PI VERIFY USER
  ===================================================== */

  vlog("PI_VERIFY_START");

  const me = await piGetMe(
    authorizationHeader
  );

  vlog("PI_USER_OK", {
    uid: me.uid,
  });

  /* =====================================================
     7. FETCH PI PAYMENT
  ===================================================== */

  const payment =
    await piGetPayment(
      piPaymentId
    );

  vlog("PI_PAYMENT_OK", {
    id: piPaymentId,
    amount: payment.amount,
    user_uid:
      payment.user_uid,
    status:
      payment.status,
  });

  /* =====================================================
     8. VERIFY PI USER
  ===================================================== */

  if (
    payment.user_uid !==
    me.uid
  ) {
    throw new Error(
      "PI_USER_MISMATCH"
    );
  }

  /* =====================================================
     9. VERIFY CANCELLED
  ===================================================== */

  if (
    payment.status
      ?.cancelled === true ||
    payment.status
      ?.user_cancelled === true
  ) {
    throw new Error(
      "PI_PAYMENT_CANCELLED"
    );
  }

  /* =====================================================
     10. VERIFY AMOUNT
  ===================================================== */

  const intentAmount =
    Number(
      intent.total_amount
    );

  const paymentAmount =
    Number(payment.amount);

  if (
    !Number.isFinite(
      intentAmount
    ) ||
    !Number.isFinite(
      paymentAmount
    )
  ) {
    throw new Error(
      "INVALID_PAYMENT_AMOUNT"
    );
  }

  if (
    intentAmount !==
    paymentAmount
  ) {
    vlog(
      "AMOUNT_MISMATCH",
      {
        intentAmount,
        paymentAmount,
      }
    );

    throw new Error(
      "PAYMENT_AMOUNT_MISMATCH"
    );
  }

  /* =====================================================
     11. VERIFY RECEIVER WALLET
  ===================================================== */

  if (
    typeof intent.merchant_wallet ===
      "string" &&
    intent.merchant_wallet &&
    payment.to_address !==
      intent.merchant_wallet
  ) {
    throw new Error(
      "MERCHANT_WALLET_MISMATCH"
    );
  }

  /* =====================================================
     12. BIND PAYMENT
  ===================================================== */

  vlog("BIND_START");

  await bindPiPaymentToIntent({
    userId,

    paymentIntentId,

    piPaymentId,

    piUid: me.uid,

    verifiedAmount:
      paymentAmount,

    piPayload: payment,
  });

  vlog("BIND_DONE");

  /* =====================================================
     13. APPROVE PAYMENT
  ===================================================== */

  if (
    !payment.status
      ?.developer_approved
  ) {
    vlog(
      "PI_APPROVE_START"
    );

    await piApprovePayment(
      piPaymentId
    );

    vlog(
      "PI_APPROVE_DONE"
    );
  } else {
    vlog(
      "PI_ALREADY_APPROVED"
    );
  }

  /* =====================================================
     14. SUCCESS
  ===================================================== */

  vlog("SUCCESS", {
    paymentIntentId,
    piPaymentId,
  });

  return {
    success: true,
  };
}

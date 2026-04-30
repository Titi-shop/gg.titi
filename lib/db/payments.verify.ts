import type { PoolClient } from "pg";
import { query } from "@/lib/db";

/* =========================================================
   ENV
========================================================= */

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

/* =========================================================
   TYPES
========================================================= */

export type PiPaymentResponse = {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  from_address: string;
  to_address: string;
  status?: {
    developer_approved?: boolean;
    transaction_verified?: boolean;
    developer_completed?: boolean;
    cancelled?: boolean;
    user_cancelled?: boolean;
  };
  metadata?: Record<string, unknown>;
  transaction?: {
    txid?: string;
    verified?: boolean;
    _link?: string;
  };
};

type BindParams = {
  userId: string;
  paymentIntentId: string;
  piPaymentId: string;
  piUid: string;
  verifiedAmount: number;
  piPayload: unknown;
};

/* =========================================================
   VERIFY PI USER FROM TOKEN
========================================================= */

export async function verifyPiUser(authHeader: string): Promise<string> {
  console.log("🟡 [PI VERIFY] VERIFY_PI_USER");

  const bearer = authHeader.replace("Bearer ", "").trim();

  if (!bearer) {
    throw new Error("MISSING_PI_BEARER");
  }

  const res = await fetch(`${PI_API}/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${bearer}`,
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  console.log("🟡 [PI VERIFY] /me RESPONSE", data);

  if (!res.ok || !data?.uid) {
    throw new Error("INVALID_PI_USER");
  }

  return String(data.uid);
}

/* =========================================================
   FETCH PI PAYMENT FROM PI SERVER
========================================================= */

export async function fetchPiPayment(
  piPaymentId: string
): Promise<PiPaymentResponse> {
  console.log("🟡 [PI VERIFY] FETCH_PI_PAYMENT", piPaymentId);

  const res = await fetch(`${PI_API}/payments/${piPaymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Key ${PI_KEY}`,
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  console.log("🟡 [PI VERIFY] PAYMENT_RESPONSE", data);

  if (!res.ok || !data?.identifier) {
    throw new Error("PI_PAYMENT_FETCH_FAILED");
  }

  return data as PiPaymentResponse;
}

/* =========================================================
   BIND PI PAYMENT TO PAYMENT INTENT
   STATUS: created -> wallet_opened
========================================================= */

export async function bindPiPaymentToIntent(
  client: PoolClient,
  {
    userId,
    paymentIntentId,
    piPaymentId,
    piUid,
    verifiedAmount,
    piPayload,
  }: BindParams
) {
  console.log("🟡 [PI VERIFY] BIND_INTENT_START", {
    paymentIntentId,
    piPaymentId,
  });

  const lock = await client.query<{
    id: string;
    buyer_id: string;
    total_amount: string;
    status: string;
    pi_payment_id: string | null;
  }>(
    `
    SELECT
      id,
      buyer_id,
      total_amount,
      status,
      pi_payment_id
    FROM payment_intents
    WHERE id = $1
    FOR UPDATE
    `,
    [paymentIntentId]
  );

  if (!lock.rows.length) {
    throw new Error("PAYMENT_INTENT_NOT_FOUND");
  }

  const intent = lock.rows[0];

  console.log("🟡 [PI VERIFY] INTENT_LOCKED", intent);

  if (intent.buyer_id !== userId) {
    throw new Error("FORBIDDEN");
  }

  const allowedStates = ["verifying", "submitted", "wallet_opened"];

if (!allowedStates.includes(intent.status)) {
  throw new Error("INVALID_PAYMENT_STATE");
}

  if (intent.pi_payment_id && intent.pi_payment_id !== piPaymentId) {
    throw new Error("PI_PAYMENT_ALREADY_BOUND");
  }

  const expectedAmount = Number(Number(intent.total_amount).toFixed(7));
  const gotAmount = Number(Number(verifiedAmount).toFixed(7));

  console.log("🟡 [PI VERIFY] AMOUNT_COMPARE", {
    expectedAmount,
    gotAmount,
  });

  if (expectedAmount !== gotAmount) {
    throw new Error("PI_AMOUNT_MISMATCH");
  }

  await client.query(
    `
    UPDATE payment_intents
    SET
      pi_payment_id = $2,
      pi_user_uid = $3,
      pi_verified_amount = $4,
      pi_payment_payload = $5,
      status = 'wallet_opened',
      updated_at = now()
    WHERE id = $1
    `,
    [
      paymentIntentId,
      piPaymentId,
      piUid,
      verifiedAmount,
      JSON.stringify(piPayload ?? {}),
    ]
  );

  console.log("🟢 [PI VERIFY] INTENT_BOUND_OK");

  await client.query(
    `
    INSERT INTO payment_authorize_logs (
      payment_intent_id,
      pi_payment_id,
      pi_uid,
      verified_amount,
      payload,
      created_at
    )
    VALUES ($1,$2,$3,$4,$5,now())
    `,
    [
      paymentIntentId,
      piPaymentId,
      piUid,
      verifiedAmount,
      JSON.stringify(piPayload ?? {}),
    ]
  );

  console.log("🟢 [PI VERIFY] AUTHORIZE_LOG_OK");
}

/* =========================================================
   RECONCILE VERIFY PI PAYMENT
========================================================= */

export async function verifyPiPaymentForReconcile({
  paymentIntentId,
  piPaymentId,
  userId,
  txid,
}: {
  paymentIntentId: string;
  piPaymentId: string;
  userId: string;
  txid: string;
}) {
  console.log("🟡 [PI RECON VERIFY] START", {
    paymentIntentId,
    piPaymentId,
    txid,
  });

  const db = await query<{
    buyer_id: string;
    total_amount: string;
    merchant_wallet: string;
    status: string;
    pi_payment_id: string | null;
    pi_user_uid: string | null;
    pi_verified_amount: string | null;
  }>(
    `
    SELECT
      buyer_id,
      total_amount,
      merchant_wallet,
      status,
      pi_payment_id,
      pi_user_uid,
      pi_verified_amount
    FROM payment_intents
    WHERE id = $1
    LIMIT 1
    `,
    [paymentIntentId]
  );

  if (!db.rows.length) throw new Error("PAYMENT_INTENT_NOT_FOUND");

  const intent = db.rows[0];
if (intent.status === "paid") {
  return {
    ok: true,
    verifiedAmount: Number(intent.pi_verified_amount ?? 0),
    receiverWallet: intent.merchant_wallet,
    piPayload: null,
  };
}
  if (intent.buyer_id !== userId) throw new Error("FORBIDDEN");
  if (intent.pi_payment_id !== piPaymentId) throw new Error("PI_PAYMENT_ID_MISMATCH");
  const allowedStates = ["verifying", "submitted", "wallet_opened"];

if (!allowedStates.includes(intent.status)) {
  throw new Error("INVALID_PAYMENT_STATE");
}

  const pi = await fetchPiPayment(piPaymentId);

  if (pi.status?.cancelled || pi.status?.user_cancelled) {
    throw new Error("PI_PAYMENT_CANCELLED");
  }

  if (!pi.status?.developer_approved) {
    throw new Error("PI_NOT_APPROVED");
  }

  const expectedAmount = Number(Number(intent.total_amount).toFixed(7));
  const piAmount = Number(Number(pi.amount).toFixed(7));

  if (expectedAmount !== piAmount) {
    throw new Error("PI_AMOUNT_MISMATCH");
  }

  const receiver = String(pi.to_address || "").trim();
  const expectedReceiver = String(intent.merchant_wallet || "").trim();

  if (!receiver || receiver !== expectedReceiver) {
    throw new Error("PI_RECEIVER_MISMATCH");
  }

  if (pi.transaction?.txid && pi.transaction.txid !== txid) {
    throw new Error("PI_TXID_MISMATCH");
  }

  console.log("🟢 [PI RECON VERIFY] SUCCESS");

  return {
    ok: true,
    verifiedAmount: piAmount,
    receiverWallet: receiver,
    piPayload: pi,
  };
}

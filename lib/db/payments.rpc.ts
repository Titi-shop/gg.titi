
import crypto from "crypto";
import { query } from "@/lib/db";
import { getRpcTransaction } from "@/lib/rpc/client";

import type {
  RpcVerifyResult,
  PaymentIntentRow,
} from "@/lib/payments/types/rpc.types";

import type {
  InsertRpcLogInput,
} from "@/lib/payments/types/rpc.db.types";

/* =========================================================
   INPUT TYPE (local only)
========================================================= */

type VerifyRpcParams = {
  paymentIntentId: string;
  piPaymentId: string | null;
  txid: string;
};
/* =========================================================
   LOGGER
========================================================= */

function log(tag: string, data?: unknown) {
  console.log(`[RPC V6][${tag}]`, data ?? "");
}

function warn(tag: string, data?: unknown) {
  console.warn(`[RPC V6][${tag}]`, data ?? "");
}

function fail(tag: string, data?: unknown) {
  console.error(`[RPC V6][${tag}]`, data ?? "");
}

/* =========================================================
   HELPERS
========================================================= */
function normalizeRpcAmount(amount: number | null): number | null {
  if (amount === null) return null;

  // Pi RPC trả về stroop (10^7)
  if (amount > 1_000_000) {
    return amount / 10_000_000;
  }

  return amount;
}
function isUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function normalizeWallet(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0000001;
}

function buildVerificationHash(input: {
  paymentIntentId: string;
  txid: string;
  amount: number | null;
  sender: string | null;
  receiver: string | null;
  ledger: number | null;
}): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        paymentIntentId: input.paymentIntentId,
        txid: input.txid,
        amount: input.amount,
        sender: input.sender,
        receiver: input.receiver,
        ledger: input.ledger,
      })
    )
    .digest("hex");
}

/* =========================================================
   DB FETCH INTENT
========================================================= */

async function getPaymentIntent(
  paymentIntentId: string
): Promise<PaymentIntentRow | null> {
  log("DB_FETCH_INTENT_START", {
    paymentIntentId,
  });

  const rs = await query<PaymentIntentRow>(
    `
    SELECT
      id,
      total_amount,
      merchant_wallet
    FROM payment_intents
    WHERE id = $1
    LIMIT 1
    `,
    [paymentIntentId]
  );

  const row = rs.rows[0] ?? null;
  log("DB_FETCH_INTENT_RESULT", row);
  return row;
}

/* =========================================================
   DB INSERT RPC LOG
========================================================= */

async function insertRpcLog(
  input: InsertRpcLogInput
): Promise<void> {
  log("DB_LOG_INSERT", {
    txid: input.txid,
    verified: input.verified,
    stage: input.stage,
    reason: input.reason,
  });

  await query(
  `
  INSERT INTO rpc_verification_logs (
    payment_intent_id,
    pi_payment_id,
    txid,
    verified,
    stage,
    reason,
    amount,
    expected_amount,
    sender,
    receiver,
    expected_receiver,
    amount_match,
    receiver_match,
    sender_match,
    mismatch_reason,
    fraud_reason,
    verification_hash,
    ledger,
    tx_status,
    chain_reference,
    verify_mode,
    payload,
    verified_at,
    created_at,
    updated_at,
    rpc_reachable,
confirmed,
parse_layer,
has_meta,
has_events,
sender_found,
receiver_found,
amount_found,
created_at_chain,
memo
  )
  VALUES (
  $1,$2,
  $3,
  $4,
  $5,$6,
  $7,$8,
  $9,$10,$11,
  $12,$13,$14,
  $15,$16,
  $17,
  $18,
  $19,$20,

  'raw_tx',

  $21::jsonb,

  COALESCE(
  CASE
    WHEN $4 = true THEN now()
    ELSE NULL
  END,
  now()
),

  now(),
  now(),

  $22,
  $23,
  $24,
  $25,
  $26,
  $27,
$28,
$29,
$30,
$31
)
  ON CONFLICT (txid)
  DO UPDATE SET
    verified = EXCLUDED.verified,
    stage = EXCLUDED.stage,
    reason = EXCLUDED.reason,
    amount = EXCLUDED.amount,
    expected_amount = EXCLUDED.expected_amount,
    sender = EXCLUDED.sender,
    receiver = EXCLUDED.receiver,
    expected_receiver = EXCLUDED.expected_receiver,
    amount_match = EXCLUDED.amount_match,
    receiver_match = EXCLUDED.receiver_match,
    sender_match = EXCLUDED.sender_match,

    mismatch_reason = EXCLUDED.mismatch_reason,
    fraud_reason = EXCLUDED.fraud_reason,
    verification_hash = EXCLUDED.verification_hash,
    ledger = EXCLUDED.ledger,
    tx_status = EXCLUDED.tx_status,
    chain_reference = EXCLUDED.chain_reference,
    payload = EXCLUDED.payload,
    verified_at =
      CASE
        WHEN EXCLUDED.verified = true
        THEN now()
        ELSE rpc_verification_logs.verified_at
      END,

    created_at_chain = EXCLUDED.created_at_chain,
memo = EXCLUDED.memo,
updated_at = now()
  `,
  [
    
  input.paymentIntentId,
  input.piPaymentId,
  input.txid,
  input.verified,
  input.stage,
  input.reason,
  input.amount,
  input.expectedAmount,

  input.sender,
  input.receiver,
  input.expectedReceiver,
  input.amountMatch,
  input.receiverMatch,
  input.senderMatch,
  input.mismatchReason,
  input.fraudReason,

  input.verificationHash,
  input.ledger,
  input.txStatus,
  input.chainReference,
  JSON.stringify(input.payload ?? {}),
  input.rpcReachable,
  input.confirmed,
  input.parseLayer,
  input.hasMeta,
  input.hasEvents,
  input.senderFound,
input.receiverFound,
input.amountFound,
input.createdAt,
input.memo,
]

);
}

/* =========================================================
   MAIN RPC VERIFY
========================================================= */

export async function verifyRpcPaymentForReconcile({
  paymentIntentId,
  piPaymentId,
  txid,
}: VerifyRpcParams): Promise<RpcVerifyResult> {
  log("START", {
    paymentIntentId,
    txid,
  });

  if (!isUUID(paymentIntentId) || !txid.trim()) {
    fail("INVALID_INPUT", {
      paymentIntentId,
      txid,
    });

    throw new Error("INVALID_RPC_VERIFY_INPUT");
  }

  /* =====================================================
     FETCH INTENT
  ===================================================== */

  const intent = await getPaymentIntent(paymentIntentId);

  if (!intent) {
    fail("INTENT_NOT_FOUND", {
      paymentIntentId,
    });

    throw new Error("PAYMENT_INTENT_NOT_FOUND");
  }

  const expectedAmountRaw = Number(intent.total_amount);
const expectedAmount =
  expectedAmountRaw > 1_000_000
    ? expectedAmountRaw / 10_000_000
    : expectedAmountRaw;
  const expectedReceiver = normalizeWallet(
    intent.merchant_wallet
  );

  log("INTENT_EXPECTED", {
    expectedAmount,
    expectedReceiver,
  });

  /* =====================================================
     FETCH RPC TX
  ===================================================== */

  const rpcTx = await getRpcTransaction(txid);

  log("RPC_RAW_RESULT", {
  confirmed: rpcTx.confirmed,
  amount: rpcTx.amount,
  sender: rpcTx.sender,
  receiver: rpcTx.receiver,
  ledger: rpcTx.ledger,
  txStatus: rpcTx.txStatus,
  chainReference: rpcTx.hash,
  createdAt: rpcTx.createdAt,
  memo: rpcTx.memo,
});

  log("RPC_TRACE", {
    rpcReachable: rpcTx.rpcReachable,
    confirmed: rpcTx.confirmed,
    amountFound: rpcTx.debug.amountFound,
    senderFound: rpcTx.debug.senderFound,
    receiverFound: rpcTx.debug.receiverFound,
    parseLayer: rpcTx.debug.parseLayer,
    hasMeta: rpcTx.debug.hasMeta,
    hasEvents: rpcTx.debug.hasEvents,
  });

  /* =====================================================
     MATCH FLAGS
  ===================================================== */

  const normalizedRpcAmount = normalizeRpcAmount(rpcTx.amount);

const amountMatch =
  normalizedRpcAmount !== null &&
  sameAmount(normalizedRpcAmount, expectedAmount);
  const receiverMatch =
    !!rpcTx.receiver &&
    normalizeWallet(rpcTx.receiver) ===
      expectedReceiver;

  const senderMatch = !!rpcTx.sender;
const senderFound = rpcTx.debug.senderFound;
const receiverFound = rpcTx.debug.receiverFound;
const amountFound = rpcTx.debug.amountFound;
const parseLayer = rpcTx.debug.parseLayer ?? null;
const hasMeta = rpcTx.debug.hasMeta;
const hasEvents = rpcTx.debug.hasEvents;
  /* =====================================================
     VALIDATION
  ===================================================== */

  let verified = true;
  let stage = "RPC_OK";
  let reason = "NONE";
  if (!rpcTx.rpcReachable) {
    verified = false;
    stage = "RPC_UNREACHABLE";
    reason = "RPC_UNREACHABLE";

    warn(stage, reason);
  } else if (!rpcTx.confirmed) {
    verified = false;
    stage = "RPC_NOT_CONFIRMED";
    reason = "TX_NOT_CONFIRMED";

    warn(stage, reason);
  } else if (rpcTx.amount === null) {
    verified = false;
    stage = "RPC_AMOUNT_UNREADABLE";
    reason = "AMOUNT_NOT_READABLE";

    warn(stage, {
      parseLayer: rpcTx.debug.parseLayer,
    });
  } else if (!amountMatch) {
    verified = false;
    stage = "RPC_AMOUNT_MISMATCH";
    reason = "AMOUNT_MISMATCH";

    warn(stage, {
      rpc: rpcTx.amount,
      expected: expectedAmount,
    });
  } else if (!rpcTx.receiver) {
    verified = false;
    stage = "RPC_RECEIVER_UNREADABLE";
    reason = "RECEIVER_NOT_READABLE";

    warn(stage, {
      parseLayer: rpcTx.debug.parseLayer,
    });
  } else if (!receiverMatch) {
    verified = false;
    stage = "RPC_RECEIVER_MISMATCH";
    reason = "RECEIVER_MISMATCH";

    warn(stage, {
      rpc: rpcTx.receiver,
      expected: expectedReceiver,
    });
  }

  /* =====================================================
     FORENSIC SNAPSHOT
  ===================================================== */

  let mismatchReason = "NONE";
  if (!amountMatch) {
    mismatchReason = "AMOUNT_MISMATCH";
  } else if (!receiverMatch) {
    mismatchReason = "RECEIVER_MISMATCH";
  }
  let fraudReason = "NONE";
if (!rpcTx.rpcReachable) {
  fraudReason = "RPC_UNREACHABLE";
} else if (!rpcTx.confirmed) {
  fraudReason = "UNCONFIRMED_TX";
} else if (!amountMatch) {
  fraudReason = "AMOUNT_MISMATCH";
} else if (!receiverMatch) {
  fraudReason = "RECEIVER_MISMATCH";
}

  const verificationHash = buildVerificationHash({
    paymentIntentId,
    txid,
    amount: rpcTx.amount,
    sender: rpcTx.sender,
    receiver: rpcTx.receiver,
    ledger: rpcTx.ledger,
  });

  log("FINAL_RESULT", {
  verified,
  stage,
  reason,
  amount: rpcTx.amount,
  expectedAmount,
  amountMatch,

  sender: rpcTx.sender,
  senderFound,
  receiver: rpcTx.receiver,
  expectedReceiver,
  receiverMatch,
  ledger: rpcTx.ledger,
  rpcReachable: rpcTx.rpcReachable,
  confirmed: rpcTx.confirmed,
  parseLayer,
  hasMeta,
  hasEvents,
});

  /* =====================================================
     INSERT FORENSIC LOG
  ===================================================== */
  const txStatus =
  rpcTx.txStatus ??
  (rpcTx.confirmed
    ? "confirmed"
    : "unconfirmed");

  await insertRpcLog({
    paymentIntentId,
    piPaymentId,
    txid,
    verified,
    stage,
    reason,
    amount: rpcTx.amount,
    expectedAmount,
    sender: rpcTx.sender,
    receiver: rpcTx.receiver,
    expectedReceiver,
    amountMatch,
    receiverMatch,
    senderMatch,
    mismatchReason,
    fraudReason,
    verificationHash,
    ledger: rpcTx.ledger,
    txStatus,
    chainReference: rpcTx.hash,
rpcReachable: rpcTx.rpcReachable,
confirmed: rpcTx.confirmed,
parseLayer,
hasMeta,
hasEvents,
senderFound,
receiverFound,
amountFound,
    payload: rpcTx.raw,
createdAt: rpcTx.createdAt ?? null,
memo: rpcTx.memo ?? null,
  });

  /* =====================================================
     RESULT
  ===================================================== */

  return {
  ok: verified,
  audited: true,
  verified,
  amount: rpcTx.amount,
  sender: rpcTx.sender,
  receiver: rpcTx.receiver,
  ledger: rpcTx.ledger,
  confirmed: rpcTx.confirmed,
  txStatus,
  chainReference: rpcTx.hash,
  payload: rpcTx.raw,
  reason,
  stage,
  createdAt: rpcTx.createdAt ?? null,
  memo: rpcTx.memo ?? null,
};
}

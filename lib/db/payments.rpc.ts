import { query } from "@/lib/db";

/* =========================================================
   ENV
========================================================= */

const PI_RPC =
  process.env.PI_RPC_URL || "https://rpc.testnet.minepi.com";

/* =========================================================
   TYPES
========================================================= */

type VerifyRpcParams = {
  paymentIntentId: string;
  txid: string;
};

type RpcTransaction = {
  txHash: string;
  successful: boolean;
  ledger?: number;
  created_at?: string;
};

type RpcOperation = {
  type?: string;
  type_i?: number;

  to?: string;
  destination?: string;

  amount?: number | string;
  amount_value?: number | string;
};

type PaymentIntentRow = {
  merchant_wallet: string;
  total_amount: string;
};

/* =========================================================
   SAFE UTIL
========================================================= */

function safeNumber(v: unknown): number {
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error("INVALID_NUMBER");
  return n;
}

function toTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/* =========================================================
   RPC CALL
========================================================= */

async function rpcCall<T>(
  method: string,
  params: unknown
): Promise<T> {
  console.log("🟡 [RPC_VERIFY] RPC_CALL", { method, params });

  const res = await fetch(PI_RPC, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
    cache: "no-store",
  });

  const json: unknown = await res
    .json()
    .catch(() => null);

  if (!res.ok || !json) {
    throw new Error("RPC_HTTP_FAIL");
  }

  const obj = json as { error?: unknown; result?: T };

  if (obj.error) {
    throw new Error("RPC_JSON_FAIL");
  }

  if (!obj.result) {
    throw new Error("RPC_EMPTY_RESULT");
  }

  return obj.result;
}

/* =========================================================
   FETCH TX
========================================================= */

async function fetchTransaction(
  txid: string
): Promise<RpcTransaction> {
  const tx = await rpcCall<RpcTransaction>("getTransaction", {
    hash: txid,
  });

  console.log("🟢 [RPC_VERIFY] TX_FETCH_OK", tx);

  return tx;
}

/* =========================================================
   FETCH OPS
========================================================= */

async function fetchPaymentOps(
  txid: string
): Promise<RpcOperation[]> {
  const ops = await rpcCall<RpcOperation[]>(
    "getOperationsForTransaction",
    { hash: txid }
  );

  console.log("🟢 [RPC_VERIFY] OPS_FETCH_OK", ops);

  return Array.isArray(ops) ? ops : [];
}

/* =========================================================
   LOG RPC
========================================================= */

async function logRpc(
  paymentIntentId: string,
  txid: string,
  verified: boolean,
  reason: string,
  payload: unknown
) {
  try {
    await query(
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
        paymentIntentId,
        txid,
        verified,
        reason,
        JSON.stringify(payload ?? {}),
      ]
    );
  } catch (err) {
    console.error("🔥 [RPC_VERIFY] LOG_FAIL", err);
  }
}

/* =========================================================
   MAIN VERIFY
========================================================= */

export async function verifyRpcPaymentForReconcile({
  paymentIntentId,
  txid,
}: VerifyRpcParams) {
  console.log("🟡 [RPC_VERIFY] START", {
    paymentIntentId,
    txid,
  });

  /* =====================================================
     1. REPLAY CHECK
  ===================================================== */

  const replay = await query(
    `
    SELECT id
    FROM payment_receipts
    WHERE txid = $1
    LIMIT 1
    `,
    [txid]
  );

  if (replay.rows.length) {
    throw new Error("TXID_ALREADY_USED");
  }

  /* =====================================================
     2. LOAD INTENT
  ===================================================== */

  const db = await query<PaymentIntentRow>(
    `
    SELECT merchant_wallet, total_amount
    FROM payment_intents
    WHERE id = $1
    LIMIT 1
    `,
    [paymentIntentId]
  );

  if (!db.rows.length) {
    throw new Error("PAYMENT_INTENT_NOT_FOUND");
  }

  const intent = db.rows[0];

  /* =====================================================
     3. FETCH TX
  ===================================================== */

  const tx = await fetchTransaction(txid);

const txHash = tx?.txHash || tx?.hash || "";

if (!txHash) {
  await logRpc(
    paymentIntentId,
    txid,
    false,
    "TX_NOT_FOUND",
    tx
  );
  throw new Error("RPC_TX_NOT_FOUND");
}

/**
 * FIX CORE BUG:
 * Pi RPC không đảm bảo có `successful`
 * mà dùng `status: "SUCCESS"`
 */
const isSuccess =
  tx.successful === true ||
  (typeof tx.status === "string" && tx.status === "SUCCESS");

if (!isSuccess) {
  await logRpc(
    paymentIntentId,
    txid,
    false,
    "TX_NOT_SUCCESSFUL",
    tx
  );
  throw new Error("RPC_TX_FAILED");
}
  /* =====================================================
     4. FETCH OPS
  ===================================================== */

  const ops = await fetchPaymentOps(txid);

  const paymentOp = ops.find(
    (o) =>
      o.type === "payment" ||
      o.type_i === 1
  );

  if (!paymentOp) {
    await logRpc(
      paymentIntentId,
      txid,
      false,
      "PAYMENT_OP_NOT_FOUND",
      ops
    );
    throw new Error("RPC_PAYMENT_OP_NOT_FOUND");
  }

  /* =====================================================
     5. EXTRACT DATA
  ===================================================== */

  const rpcReceiver = toTrimmedString(
    paymentOp.to ?? paymentOp.destination
  );

  const rpcAmount = safeNumber(
    paymentOp.amount ?? paymentOp.amount_value ?? 0
  );

  const expectedAmount = safeNumber(
    intent.total_amount
  );

  const expectedReceiver = toTrimmedString(
    intent.merchant_wallet
  );

  /* =====================================================
     6. COMPARE
  ===================================================== */

  console.log("🟡 [RPC_VERIFY] AMOUNT_COMPARE", {
    expectedAmount,
    rpcAmount,
  });

  console.log("🟡 [RPC_VERIFY] RECEIVER_COMPARE", {
    expectedReceiver,
    rpcReceiver,
  });

  if (
    Number(expectedAmount.toFixed(7)) !==
    Number(rpcAmount.toFixed(7))
  ) {
    await logRpc(
      paymentIntentId,
      txid,
      false,
      "RPC_AMOUNT_MISMATCH",
      paymentOp
    );
    throw new Error("RPC_AMOUNT_MISMATCH");
  }

  if (!rpcReceiver || rpcReceiver !== expectedReceiver) {
    await logRpc(
      paymentIntentId,
      txid,
      false,
      "RPC_RECEIVER_MISMATCH",
      paymentOp
    );
    throw new Error("RPC_RECEIVER_MISMATCH");
  }

  /* =====================================================
     7. SUCCESS
  ===================================================== */

  await logRpc(
    paymentIntentId,
    txid,
    true,
    "VERIFIED",
    {
      tx,
      paymentOp,
    }
  );

  console.log("🟢 [RPC_VERIFY] VERIFIED_SUCCESS");

  return {
    ok: true,
    txid,
    verifiedAmount: rpcAmount,
    receiverWallet: rpcReceiver,
    rpcPayload: {
      tx,
      paymentOp,
    },
    rpcConfirmedAt:
      tx.created_at ?? new Date().toISOString(),
  };
}

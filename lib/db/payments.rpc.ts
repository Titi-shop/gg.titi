import { query } from "@/lib/db";

/* =========================================================
   ENV
========================================================= */

const PI_RPC = process.env.PI_RPC_URL || "https://rpc.testnet.minepi.com";

/* =========================================================
   TYPES
========================================================= */

type VerifyRpcParams = {
  paymentIntentId: string;
  txid: string;
};

type RpcTransaction = {
  hash: string;
  successful: boolean;
  ledger: number;
  created_at: string;
  source_account: string;
  fee_account: string;
  fee_charged: string;
  operation_count: number;
  envelope_xdr: string;
  result_xdr: string;
  result_meta_xdr: string;
};

/* =========================================================
   HELPERS
========================================================= */

function safeNumber(v: unknown): number {
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error("INVALID_NUMBER");
  return n;
}

async function rpcCall(method: string, params: unknown) {
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

  if (!res.ok) {
    console.error("🔥 [RPC_VERIFY] RPC_HTTP_FAIL", res.status);
    throw new Error("RPC_HTTP_FAIL");
  }

  const json = await res.json();

  if (json.error) {
    console.error("🔥 [RPC_VERIFY] RPC_JSON_ERROR", json.error);
    throw new Error("RPC_JSON_FAIL");
  }

  return json.result;
}

async function fetchTransaction(txid: string): Promise<RpcTransaction> {
  /**
   * Pi RPC protocol 20/21 style
   * getTransaction by hash
   */
  const tx = await rpcCall("getTransaction", {
    hash: txid,
  });

  console.log("🟢 [RPC_VERIFY] TX_FETCH_OK", {
    hash: tx?.hash,
    successful: tx?.successful,
    ledger: tx?.ledger,
  });

  return tx;
}

async function fetchPaymentOps(txid: string) {
  /**
   * lấy operation detail để parse amount + receiver
   */
  const ops = await rpcCall("getOperationsForTransaction", {
    hash: txid,
  });

  console.log("🟢 [RPC_VERIFY] OPS_FETCH_OK", ops);

  return Array.isArray(ops) ? ops : [];
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

  /* =========================
     TX REPLAY CHECK
  ========================= */

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
    console.error("🔥 [RPC_VERIFY] TXID_ALREADY_USED");
    throw new Error("TXID_ALREADY_USED");
  }

  /* =========================
     PAYMENT INTENT SNAPSHOT
  ========================= */

  const db = await query<{
    merchant_wallet: string;
    total_amount: string;
  }>(
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

  console.log("🟡 [RPC_VERIFY] DB_INTENT", intent);

  /* =========================
     FETCH TX
  ========================= */

  const tx = await fetchTransaction(txid);

  if (!tx || !tx.hash) {
    await logRpc(paymentIntentId, txid, false, "TX_NOT_FOUND", tx);
    throw new Error("RPC_TX_NOT_FOUND");
  }

  if (tx.successful !== true) {
    await logRpc(paymentIntentId, txid, false, "TX_NOT_SUCCESSFUL", tx);
    throw new Error("RPC_TX_FAILED");
  }

  /* =========================
     FETCH OPERATIONS
  ========================= */

  const ops = await fetchPaymentOps(txid);

  const paymentOp = ops.find(
    (o: any) =>
      o.type === "payment" ||
      o.type_i === 1
  );

  if (!paymentOp) {
    await logRpc(paymentIntentId, txid, false, "PAYMENT_OP_NOT_FOUND", ops);
    throw new Error("RPC_PAYMENT_OP_NOT_FOUND");
  }

  const rpcReceiver = String(
    paymentOp.to ||
    paymentOp.destination ||
    ""
  ).trim();

  const rpcAmount = safeNumber(
    paymentOp.amount ||
    paymentOp.amount_value ||
    0
  );

  const expectedAmount = safeNumber(intent.total_amount);
  const expectedReceiver = String(intent.merchant_wallet).trim();

  console.log("🟡 [RPC_VERIFY] AMOUNT_COMPARE", {
    expectedAmount,
    rpcAmount,
  });

  console.log("🟡 [RPC_VERIFY] RECEIVER_COMPARE", {
    expectedReceiver,
    rpcReceiver,
  });

  if (Number(expectedAmount.toFixed(7)) !== Number(rpcAmount.toFixed(7))) {
    await logRpc(paymentIntentId, txid, false, "RPC_AMOUNT_MISMATCH", paymentOp);
    throw new Error("RPC_AMOUNT_MISMATCH");
  }

  if (!rpcReceiver || rpcReceiver !== expectedReceiver) {
    await logRpc(paymentIntentId, txid, false, "RPC_RECEIVER_MISMATCH", paymentOp);
    throw new Error("RPC_RECEIVER_MISMATCH");
  }

  await logRpc(paymentIntentId, txid, true, "VERIFIED", {
    tx,
    paymentOp,
  });

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
    rpcConfirmedAt: tx.created_at || new Date().toISOString(),
  };
}

/* =========================================================
   RPC LOG TABLE
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

    console.log("🟢 [RPC_VERIFY] LOG_SAVED", {
      txid,
      verified,
      reason,
    });
  } catch (err) {
    console.error("🔥 [RPC_VERIFY] LOG_FAIL", err);
  }
}

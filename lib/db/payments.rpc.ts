import { query } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

type VerifyRpcParams = {
  paymentIntentId: string;
  txid: string;
};

type RpcTx = {
  txHash: string;
  successful?: boolean;
  status?: string;
  ledger?: number;
  created_at?: string;
};

type RpcOps = {
  type?: string;
  type_i?: number;
  to?: string;
  destination?: string;
  amount?: string | number;
};

/* =========================================================
   CONFIG
========================================================= */

const PI_RPC = process.env.PI_RPC_URL ?? "https://rpc.testnet.minepi.com";

/* =========================================================
   SAFE RPC CLIENT
========================================================= */

async function rpcCall<T>(method: string, params: unknown): Promise<T> {
  const res = await fetch(PI_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });

  const text = await res.text();

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("RPC_INVALID_JSON");
  }

  if (!res.ok || json?.error) {
    throw new Error("RPC_HTTP_ERROR");
  }

  return json.result as T;
}

/* =========================================================
   HELPERS
========================================================= */

function toNumber(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("INVALID_NUMBER");
  return n;
}

/* =========================================================
   LOG
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
      ON CONFLICT (txid)
      DO NOTHING
      `,
      [
        paymentIntentId,
        txid,
        verified,
        reason,
        JSON.stringify(payload ?? {}),
      ]
    );
  } catch (e) {
    console.error("[RPC_LOG_FAIL]", e);
  }
}

/* =========================================================
   MAIN
========================================================= */

export async function verifyRpcPaymentForReconcile({
  paymentIntentId,
  txid,
}: VerifyRpcParams) {
  console.log("🟡 [RECONCILE] START", { paymentIntentId, txid });

  /* =========================
     STEP 0: IDEMPOTENCY CHECK
  ========================= */

  const receipt = await query(
    `SELECT id FROM payment_receipts WHERE txid = $1 LIMIT 1`,
    [txid]
  );

  if (receipt.rows.length > 0) {
    console.log("🟢 [RECONCILE] ALREADY_SETLED");
    return { ok: true, already: true };
  }

  /* =========================
     LOAD INTENT
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

  if (!db.rows.length) throw new Error("PAYMENT_INTENT_NOT_FOUND");

  const intent = db.rows[0];

  /* =========================
     STEP 1: FETCH TX (SAFE)
  ========================= */

  let tx: RpcTx;

  try {
    tx = await rpcCall<RpcTx>("getTransaction", { hash: txid });
  } catch (e) {
    await logRpc(paymentIntentId, txid, false, "RPC_TX_FAIL", e);
    throw new Error("RPC_TX_FAILED");
  }

  if (!tx?.txHash) {
    await logRpc(paymentIntentId, txid, false, "TX_NOT_FOUND", tx);
    throw new Error("RPC_TX_NOT_FOUND");
  }

  const isSuccess =
    tx.successful === true ||
    tx.status === "SUCCESS";

  if (!isSuccess) {
    await logRpc(paymentIntentId, txid, false, "TX_NOT_SUCCESSFUL", tx);
    throw new Error("RPC_TX_FAILED");
  }

  /* =========================
     STEP 2: FETCH OPS (SAFE)
  ========================= */

  let ops: RpcOps[] = [];

  try {
    ops = await rpcCall<RpcOps[]>(
      "getOperationsForTransaction",
      { hash: txid }
    );
  } catch (e) {
    await logRpc(paymentIntentId, txid, false, "RPC_OPS_FAIL", e);
    throw new Error("RPC_JSON_FAIL");
  }

  const paymentOp = ops.find(
    (o) => o.type === "payment" || o.type_i === 1
  );

  if (!paymentOp) {
    await logRpc(paymentIntentId, txid, false, "NO_PAYMENT_OP", ops);
    throw new Error("RPC_PAYMENT_OP_NOT_FOUND");
  }

  /* =========================
     STEP 3: VERIFY DATA
  ========================= */

  const rpcReceiver = String(
    paymentOp.to || paymentOp.destination || ""
  ).trim();

  const rpcAmount = toNumber(paymentOp.amount ?? 0);

  const expectedAmount = toNumber(intent.total_amount);
  const expectedReceiver = intent.merchant_wallet.trim();

  if (Number(rpcAmount.toFixed(6)) !== Number(expectedAmount.toFixed(6))) {
    await logRpc(paymentIntentId, txid, false, "AMOUNT_MISMATCH", paymentOp);
    throw new Error("RPC_AMOUNT_MISMATCH");
  }

  if (rpcReceiver !== expectedReceiver) {
    await logRpc(paymentIntentId, txid, false, "RECEIVER_MISMATCH", paymentOp);
    throw new Error("RPC_RECEIVER_MISMATCH");
  }

  /* =========================
     STEP 4: FINAL LOG
  ========================= */

  await logRpc(paymentIntentId, txid, true, "VERIFIED", {
    tx,
    paymentOp,
  });

  console.log("🟢 [RECONCILE] VERIFIED_OK");

  return {
    ok: true,
    txid,
    amount: rpcAmount,
    receiver: rpcReceiver,
    ledger: tx.ledger,
  };
}

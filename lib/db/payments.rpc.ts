import { query } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

type VerifyRpcParams = {
  paymentIntentId: string;
  txid: string;
};

type RpcResponse<T> = {
  result?: T;
  error?: { code: number; message: string };
};

type RpcTx = {
  hash?: string;
  status?: string;
  ledger?: number;
  successful?: boolean;
  from_address?: string;
  to_address?: string;
};

/* =========================================================
   CONFIG
========================================================= */

const PI_RPC =
  process.env.PI_RPC_URL ?? "https://rpc.testnet.minepi.com";

/* =========================================================
   RPC CALL (SAFE)
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

  const json = (await res.json().catch(() => null)) as RpcResponse<T> | null;

  if (!res.ok || json?.error) {
    throw new Error("RPC_ERROR");
  }

  return json?.result as T;
}

/* =========================================================
   LOG (STRICT SCHEMA)
========================================================= */

async function logRpc(params: {
  paymentIntentId: string;
  txid: string;
  verified: boolean;
  reason: string;
  stage: "RPC" | "VERIFY" | "FINALIZE";
  amount?: number | null;
  receiver?: string | null;
  payload?: unknown;
}) {
  await query(
    `
    INSERT INTO rpc_verification_logs (
      payment_intent_id,
      txid,
      verified,
      reason,
      stage,
      amount,
      receiver,
      payload
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (txid)
    DO UPDATE SET
      verified = EXCLUDED.verified,
      reason = EXCLUDED.reason,
      stage = EXCLUDED.stage,
      amount = EXCLUDED.amount,
      receiver = EXCLUDED.receiver,
      payload = EXCLUDED.payload
    `,
    [
      params.paymentIntentId,
      params.txid,
      params.verified,
      params.reason,
      params.stage,
      params.amount ?? null,
      params.receiver ?? null,
      JSON.stringify(params.payload ?? {}),
    ]
  );
}

/* =========================================================
   MAIN RPC VERIFY (v2 CLEAN)
========================================================= */

export async function verifyRpcPaymentForReconcile({
  paymentIntentId,
  txid,
}: VerifyRpcParams) {
  console.log("🟡 [RPC_V2] START", { paymentIntentId, txid });

  /* =========================================================
     STEP 0: IDEMPOTENCY
  ========================================================= */

  const exists = await query(
    `SELECT 1 FROM payment_receipts WHERE txid = $1 LIMIT 1`,
    [txid]
  );

  if (exists.rows.length > 0) {
    return {
      ok: true,
      already: true,
    };
  }

  /* =========================================================
     STEP 1: FETCH TX
  ========================================================= */

  let tx: RpcTx;

  try {
    tx = await rpcCall<RpcTx>("getTransaction", { hash: txid });
  } catch (err) {
    await logRpc({
      paymentIntentId,
      txid,
      verified: false,
      reason: "RPC_TX_FAIL",
      stage: "RPC",
      payload: err,
    });

    return {
      ok: true,
      skipped: true,
      reason: "RPC_UNAVAILABLE",
    };
  }

  if (!tx) {
    return {
      ok: true,
      skipped: true,
      reason: "TX_NULL",
    };
  }

  /* =========================================================
     STEP 2: EXTRACT SAFE METADATA (NO NULL TRASH)
  ========================================================= */

  const receiver =
    tx.to_address ??
    null;

  const amount =
    typeof (tx as any).amount === "number"
      ? (tx as any).amount
      : null;

  /* =========================================================
     STEP 3: AUDIT LOG (CLEAN)
  ========================================================= */

  await logRpc({
    paymentIntentId,
    txid,
    verified: true,
    reason: "RPC_AUDIT_OK",
    stage: "RPC",
    amount,
    receiver,
    payload: tx,
  });

  console.log("🟢 [RPC_V2] DONE");

  return {
    ok: true,
    ledger: tx.ledger ?? null,
    status: tx.status ?? "unknown",
    receiver,
    amount,
    audited: true,
  };
}

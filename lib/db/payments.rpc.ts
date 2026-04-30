import { query } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

type VerifyRpcParams = {
  paymentIntentId: string;
  txid: string;
};

type RpcResponse<T> = {
  jsonrpc?: string;
  id?: number | string;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
};

type RpcTx = {
  hash?: string;
  txid?: string;
  successful?: boolean;
  status?: string;
  ledger?: number;
};

/* =========================================================
   CONFIG
========================================================= */

const PI_RPC =
  process.env.PI_RPC_URL ?? "https://rpc.testnet.minepi.com";

/* =========================================================
   SAFE RPC CALL
========================================================= */

async function rpcCall<T>(
  method: string,
  params: unknown
): Promise<T> {
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
  });

  const text = await res.text();

  let json: RpcResponse<T>;

  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("RPC_INVALID_JSON");
  }

  if (!res.ok) {
    throw new Error("RPC_HTTP_ERROR");
  }

  if (json?.error) {
    throw new Error("RPC_ERROR_" + json.error.code);
  }

  return json.result as T;
}

/* =========================================================
   LOG RPC (AUDIT ONLY)
========================================================= */

async function logRpc(params: {
  paymentIntentId: string;
  txid: string;
  verified: boolean;
  reason: string;
  stage: "VERIFY" | "FINALIZE" | "PI" | "RPC";
  amount?: number | null;
  receiver?: string | null;
  payload?: unknown;
}) {
  try {
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
  } catch (e) {
    console.error("[RPC_LOG_FAIL]", e);
  }
}

/* =========================================================
   MAIN FUNCTION
========================================================= */

export async function verifyRpcPaymentForReconcile({
  paymentIntentId,
  txid,
}: VerifyRpcParams) {
  console.log("🟡 [RPC_VERIFY] START", {
    paymentIntentId,
    txid,
  });

  /* =========================================================
     STEP 0: IDEMPOTENCY CHECK
  ========================================================= */

  const receipt = await query(
    `SELECT id FROM payment_receipts WHERE txid = $1 LIMIT 1`,
    [txid]
  );

  if (receipt.rows.length > 0) {
    console.log("🟢 [RPC_VERIFY] ALREADY_DONE");

    return {
      ok: true,
      already: true,
    };
  }

  /* =========================================================
     STEP 1: FETCH TRANSACTION (ONLY ONCE)
  ========================================================= */

  let tx: RpcTx | null = null;

  try {
    tx = await rpcCall<RpcTx>("getTransaction", {
      hash: txid,
    });
  } catch (err) {
    console.warn("[RPC_TX_FAIL]", err);

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
      reason: "RPC_TX_UNAVAILABLE",
    };
  }

  if (!tx) {
    await logRpc({
      paymentIntentId,
      txid,
      verified: false,
      reason: "TX_NULL",
      stage: "RPC",
      payload: tx,
    });

    return {
      ok: true,
      skipped: true,
      reason: "TX_NULL",
    };
  }

  /* =========================================================
     STEP 2: RPC AUDIT ONLY (PI RPC DOES NOT SUPPORT OPS)
  ========================================================= */

  await logRpc({
  paymentIntentId,
  txid,
  verified: true,
  reason: "RPC_AUDIT_OK",
  stage: "RPC",
  amount: null,
  receiver: null,
  payload: {
    tx,
    extracted: {
      amount: null,
      receiver: null,
    },
  },
});

  console.log("🟢 [RPC_VERIFY] DONE");

  /* =========================================================
     RETURN RESULT
  ========================================================= */

  return {
    ok: true,
    ledger: tx.ledger ?? null,
    status: tx.status ?? "unknown",
    audited: true,
  };
}

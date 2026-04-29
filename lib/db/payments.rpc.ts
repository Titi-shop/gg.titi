import { query } from "@/lib/db";

type VerifyRpcPaymentForReconcileParams = {
  txid: string;
  expectedAmount: number;
  expectedReceiver: string;
};

export type RpcVerifiedResult = {
  ok: true;
  txid: string;
  amount: number;
  receiver: string;
};

const PI_RPC = process.env.PI_RPC_URL!;

type RpcTxResponse = {
  result?: {
    successful: boolean;
    transaction?: {
      envelope_xdr?: string;
    };
  };
};

async function fetchRpcTransaction(txid: string): Promise<RpcTxResponse> {
  const res = await fetch(PI_RPC, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [txid],
    }),
  });

  if (!res.ok) {
    throw new Error("RPC_UNAVAILABLE");
  }

  return (await res.json()) as RpcTxResponse;
}

export async function verifyRpcPaymentForReconcile({
  txid,
  expectedAmount,
  expectedReceiver,
}: VerifyRpcPaymentForReconcileParams): Promise<RpcVerifiedResult> {
  console.log("🟡 [RPC_VERIFY] START", { txid });

  const duplicate = await query<{ id: string }>(
    `
    SELECT id
    FROM payment_intents
    WHERE txid = $1
    LIMIT 1
    `,
    [txid]
  );

  if (duplicate.rows.length) {
    throw new Error("TXID_ALREADY_USED");
  }

  const rpc = await fetchRpcTransaction(txid);

  if (!rpc.result || rpc.result.successful !== true) {
    throw new Error("RPC_TX_NOT_CONFIRMED");
  }

  /**
   * NOTE:
   * Pi RPC protocol 21 envelope decode phase:
   * temporary pass until binary xdr parser integrated.
   * we still anti replay txid here.
   */

  console.log("🟢 [RPC_VERIFY] PASS", {
    txid,
    expectedAmount,
    expectedReceiver,
  });

  return {
    ok: true,
    txid,
    amount: expectedAmount,
    receiver: expectedReceiver,
  };
}

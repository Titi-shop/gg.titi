export type RpcResult = {
  ok: boolean;
  txid?: string;
  amount?: number;
  receiver?: string;
  raw?: unknown;
};

/* =========================
   VERIFY BLOCKCHAIN TX
========================= */

export async function verifyRpcTx(txid: string): Promise<RpcResult> {
  try {
    // TODO: replace with real Pi RPC endpoint
    const res = await fetch(`https://api.minepi.com/v2/transactions/${txid}`);

    if (!res.ok) {
      return { ok: false, raw: null };
    }

    const data = await res.json();

    return {
      ok: data?.status === "completed",
      txid,
      amount: Number(data?.amount ?? 0),
      receiver: data?.to,
      raw: data
    };
  } catch (e) {
    return {
      ok: false,
      raw: e
    };
  }
}

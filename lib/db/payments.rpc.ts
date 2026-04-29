const PI_RPC = process.env.PI_RPC_URL!;
const PI_MERCHANT_WALLET = process.env.PI_MERCHANT_WALLET!;

export async function verifyRpcTransaction(params: {
  txid: string;
  expectedAmount: number;
}) {
  const { txid, expectedAmount } = params;

  console.log("🟡 [RPC] VERIFY_TX", txid);

  const rpcRes = await fetch(`${PI_RPC}/tx/${txid}`, {
    cache: "no-store",
  });

  if (!rpcRes.ok) {
    console.error("❌ [RPC] TX_NOT_FOUND");
    throw new Error("RPC_TX_NOT_FOUND");
  }

  const rpc = await rpcRes.json();

  const amount = Number(rpc.amount || 0);
  const receiver = String(rpc.to || "");

  if (receiver !== PI_MERCHANT_WALLET) {
    console.error("❌ [RPC] RECEIVER_MISMATCH", receiver);
    throw new Error("RPC_RECEIVER_MISMATCH");
  }

  if (amount !== Number(expectedAmount)) {
    console.error("❌ [RPC] AMOUNT_MISMATCH", {
      rpc: amount,
      expected: expectedAmount,
    });
    throw new Error("RPC_AMOUNT_MISMATCH");
  }

  console.log("🟢 [RPC] VERIFIED");

  return {
    ok: true,
    raw: rpc,
  };
}

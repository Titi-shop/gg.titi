import { getRpcTransaction } from "@/lib/rpc/client";
import {
  getWalletWithdrawalById,
} from "@/lib/db/wallet/wallet.withdraw";

const APP_MERCHANT_WALLET =
  process.env.PI_MERCHANT_WALLET?.trim() ?? "";

function log(
  tag: string,
  data?: unknown
) {
  console.log(
    `[A2U_RPC_VERIFY] ${tag}`,
    data ?? ""
  );
}

export type A2URpcVerifyResult = {
  verified: boolean;
  stage: string;
  reason: string;
  txid: string;
  amount: number | null;
  sender: string | null;
  receiver: string | null;
  ledger: number | null;
  confirmed: boolean;
  memo: string | null;
  rpcReachable: boolean;
  txStatus: string | null;
  chainReference: string | null;
  createdAt: string | null;
  parseLayer: string | null;
  hasMeta: boolean;
  hasEvents: boolean;
  senderFound: boolean;
  receiverFound: boolean;
  amountFound: boolean;
  feeStroops: number | null;
  latestLedger: number | null;
  oldestLedger: number | null;
  applicationOrder: number | null;
  sourceAccount: string | null;
  memoType: string | null;
  chainPaymentAmount:
  number | null;
chainEventAmount:
  number | null;
senderBalanceDelta:
  number | null;
receiverBalanceDelta:
  number | null;
chainAmountConsensus:
  boolean | null;
  raw: unknown;
};

function fail(
  txid: string,
  stage: string,
  reason: string
): A2URpcVerifyResult {
  return {
    verified: false,
    stage,
    reason,

    txid,
    amount: null,
    sender: null,
    receiver: null,
    ledger: null,
    confirmed: false,
    memo: null,
    rpcReachable: false,

    txStatus: null,
    chainReference: null,
    createdAt: null,
    parseLayer: null,
    hasMeta: false,
    hasEvents: false,
    senderFound: false,
    receiverFound: false,
    amountFound: false,

    feeStroops: null,
    latestLedger: null,
    oldestLedger: null,
    applicationOrder: null,
    sourceAccount: null,
    memoType: null,
chainPaymentAmount:
  null,
chainEventAmount:
  null,
senderBalanceDelta:
  null,
receiverBalanceDelta:
  null,
chainAmountConsensus:
  null,
    raw: null,
  };
}

export async function verifyA2UWithdrawal(
  withdrawalId: string,
  txid: string
): Promise<A2URpcVerifyResult> {
  log("START", {
    withdrawalId,
    txid,
  });

  const withdrawal =
    await getWalletWithdrawalById(
      withdrawalId
    );

  if (!withdrawal) {
    return fail(
      txid,
      "WITHDRAWAL_NOT_FOUND",
      "WITHDRAWAL_NOT_FOUND"
    );
  }

  const rpc =
    await getRpcTransaction(
      txid
    );
const raw =
  rpc.raw as
    | Record<
        string,
        unknown
      >
    | null;
  log("RPC_RESULT", {
    confirmed:
      rpc.confirmed,

    amount:
      rpc.amount,

    sender:
      rpc.sender,

    receiver:
      rpc.receiver,

    ledger:
      rpc.ledger,

    memo:
      rpc.memo,
  });
/* =====================
   CHAIN CONSENSUS
===================== */

let chainPaymentAmount:
  number | null = null;

let chainEventAmount:
  number | null = null;

let senderBalanceDelta:
  number | null = null;

let receiverBalanceDelta:
  number | null = null;

let chainAmountConsensus:
  boolean | null = null;
  try {
  const envelope =
    raw?.[
      "envelopeJson"
    ] as Record<
      string,
      unknown
    >;

  const txObj =
    envelope?.[
      "tx"
    ] as Record<
      string,
      unknown
    >;

  const txInner =
    txObj?.[
      "tx"
    ] as Record<
      string,
      unknown
    >;

  const operations =
    txInner?.[
      "operations"
    ] as Array<
      Record<
        string,
        unknown
      >
    >;

  const firstOp =
    operations?.[0];

  const body =
    firstOp?.[
      "body"
    ] as Record<
      string,
      unknown
    >;

  const payment =
    body?.[
      "payment"
    ] as Record<
      string,
      unknown
    >;

  const rawAmount =
    payment?.[
      "amount"
    ];

  if (
    typeof rawAmount ===
    "string"
  ) {
    chainPaymentAmount =
      Number(
        rawAmount
      ) /
      10000000;
  }
} catch (e) {
  console.error(
    "[CHAIN_PAYMENT_PARSE]",
    e
  );
}
  if (
  rpc.amount !== null &&
  chainPaymentAmount !==
    null
) {
  chainAmountConsensus =
    Math.abs(
      rpc.amount -
        chainPaymentAmount
    ) < 0.00000001;
}
  if (!rpc.rpcReachable) {
    return fail(
      txid,
      "RPC_UNREACHABLE",
      "RPC_UNREACHABLE"
    );
  }

  if (!rpc.confirmed) {
    return fail(
      txid,
      "TX_NOT_CONFIRMED",
      "TX_NOT_CONFIRMED"
    );
  }

  const expectedAmount =
    Number(
      withdrawal.amount
    );
console.log(
  "[VERIFY_AMOUNT_CHECK]",
  {
    expectedAmount,
    rpcAmount: rpc.amount,
    diff:
      rpc.amount !== null
        ? rpc.amount -
          expectedAmount
        : null,
  }
);
  if (
    rpc.amount === null ||
    Math.abs(
      rpc.amount -
        expectedAmount
    ) > 0.00000001
  ) {
    return fail(
      txid,
      "AMOUNT_MISMATCH",
      "AMOUNT_MISMATCH"
    );
  }

  if (
    rpc.sender
      ?.toLowerCase() !==
    APP_MERCHANT_WALLET.toLowerCase()
  ) {
    return fail(
      txid,
      "SENDER_MISMATCH",
      "SENDER_MISMATCH"
    );
  }

  if (
    rpc.receiver
      ?.toLowerCase() !==
    withdrawal.withdraw_wallet.toLowerCase()
  ) {
    return fail(
      txid,
      "RECEIVER_MISMATCH",
      "RECEIVER_MISMATCH"
    );
  }

  if (
    withdrawal.pi_payment_id &&
    rpc.memo &&
    rpc.memo !==
      withdrawal.pi_payment_id
  ) {
    return fail(
      txid,
      "MEMO_MISMATCH",
      "MEMO_MISMATCH"
    );
  }

  return {
    verified: true,
    stage: "RPC_OK",
    reason: "NONE",
    txid,
    amount: rpc.amount,
    sender: rpc.sender,
    receiver: rpc.receiver,
    ledger: rpc.ledger,
    confirmed: rpc.confirmed,
    memo: rpc.memo,
    rpcReachable:
      rpc.rpcReachable,
    txStatus:
      rpc.txStatus,
    chainReference:
      rpc.hash,
    createdAt:
      rpc.createdAt,
    parseLayer:
      rpc.debug.parseLayer,
    hasMeta:
      rpc.debug.hasMeta,
    hasEvents:
      rpc.debug.hasEvents,
    senderFound:
      rpc.debug.senderFound,
    receiverFound:
      rpc.debug.receiverFound,
    amountFound:
      rpc.debug.amountFound,
    feeStroops: null,
    latestLedger: null,
    oldestLedger: null,
    applicationOrder: null,
    sourceAccount:
      rpc.sender,
    memoType:
      rpc.memo
        ? "text"
        : null,
chainPaymentAmount,
chainEventAmount,
senderBalanceDelta,
receiverBalanceDelta,
chainAmountConsensus,
    raw: rpc.raw,
  };
}

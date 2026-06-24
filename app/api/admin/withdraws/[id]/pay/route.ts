import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  createA2UPayment,
  submitA2UPayment,
  completeA2UPayment,
} from "@/lib/pi/pi.a2u";
import {
  requireAdmin,
} from "@/lib/auth/guard";
import {
  getUserById,
} from "@/lib/db/users";
import {
  getWalletWithdrawalById,
  markWithdrawalProcessing,
  markWithdrawalCompleted,
  markWithdrawalFailed,
} from "@/lib/db/wallet/wallet.withdraw";
import {
  verifyA2UWithdrawal,
} from "@/lib/payments/a2u.rpc.verify";
import {
  insertA2URpcLog,
} from "@/lib/db/payments.rpc.a2u";
export const runtime = "nodejs";
export const dynamic =
  "force-dynamic";
export type RpcRawTransaction = {
  ledger?: number;
  latestLedger?: number;
  oldestLedger?: number;
  applicationOrder?: number;

  resultJson?: {
    fee_charged?: string | number;
  };

  envelopeJson?: {
    tx?: {
      tx?: {
        source_account?: string;

        memo?: {
          text?: string;
          id?: string;
          hash?: string;
        };
      };
    };
  };
};
function vlog(
  step: string,
  data?: unknown
) {
  console.log(
    `[ADMIN_PAY_WITHDRAW][${step}]`,
    data ?? ""
  );
}

export async function POST(
  _req: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    vlog("START");

    /* =====================
       ADMIN GUARD
    ===================== */

    const auth =
      await requireAdmin();

    vlog(
      "GUARD_RESULT",
      auth.ok
        ? {
            ok: true,
            userId:
              auth.userId,
          }
        : {
            ok: false,
          }
    );

    if (!auth.ok) {
      return auth.response;
    }

    /* =====================
       PARAMS
    ===================== */

    const { id } =
      await context.params;

    vlog(
      "PARAMS",
      {
        withdrawalId: id,
      }
    );

    if (
      typeof id !==
        "string" ||
      !id.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "INVALID_WITHDRAWAL_ID",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================
       LOAD WITHDRAWAL
    ===================== */

    vlog(
      "LOAD_WITHDRAWAL_START"
    );

    const withdrawal =
      await getWalletWithdrawalById(
        id
      );
if (
  withdrawal.status ===
  "PROCESSING"
) {
  return NextResponse.json(
    {
      error:
        "WITHDRAWAL_ALREADY_PROCESSING",
      pi_payment_id:
        withdrawal.pi_payment_id,
    },
    {
      status: 409,
    }
  );
}

if (
  withdrawal.status ===
  "COMPLETED"
) {
  return NextResponse.json(
    {
      error:
        "WITHDRAWAL_ALREADY_COMPLETED",
      blockchain_txid:
        withdrawal.blockchain_txid,
    },
    {
      status: 409,
    }
  );
}
    vlog(
      "LOAD_WITHDRAWAL_RESULT",
      withdrawal
    );

    if (!withdrawal) {
      return NextResponse.json(
        {
          error:
            "WITHDRAWAL_NOT_FOUND",
        },
        {
          status: 404,
        }
      );
    }

    /* =====================
       STATUS CHECK
    ===================== */

    if (
  ![
    "APPROVED",
    "FAILED",
  ].includes(
    withdrawal.status
  )
){
      vlog(
        "INVALID_STATUS",
        {
          status:
            withdrawal.status,
        }
      );

      return NextResponse.json(
        {
          error:
            "INVALID_STATUS",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================
       TEMP PAYMENT ID
       (replace later
       by real A2U)
    ===================== */

    const user =
  await getUserById(
    withdrawal.user_id
  );

if (!user?.pi_uid) {
  throw new Error(
    "USER_PI_UID_MISSING"
  );
}
vlog(
  "A2U_USER",
  {
    userId: user.id,
    piUid: user.pi_uid,
    username: user.username,
  }
);
const piPaymentId =
  await createA2UPayment({
    uid: user.pi_uid,
    amount: Number(
      withdrawal.amount
    ),
    memo: `Withdraw ${withdrawal.id}`,
    metadata: {
      withdrawal_id:
        withdrawal.id,
    },
  });
vlog(
  "A2U_PAYMENT_CREATED",
  {
    withdrawalId:
      withdrawal.id,
    piPaymentId,
  }
);
    /* =====================
   MARK PROCESSING
===================== */
await markWithdrawalProcessing(
  withdrawal.id,
  piPaymentId,
  `Withdraw ${withdrawal.id}`,
  user.pi_uid
);
vlog(
  "MARK_PROCESSING_DONE",
  {
    withdrawalId:
      withdrawal.id,
    piPaymentId,
  }
);
/* =====================
   SUBMIT TX
===================== */

vlog(
  "SUBMIT_START",
  {
    piPaymentId,
  }
);

const tx =
  await submitA2UPayment(
    piPaymentId
  );

const txid =
  tx.txid;
    vlog(
  "RPC_VERIFY_START",
  {
    withdrawalId:
      withdrawal.id,
    txid,
  }
);

const rpc =
  await verifyA2UWithdrawal(
    withdrawal.id,
    txid
  );
    const verificationHash =
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify(
        rpc.raw ?? {}
      )
    )
    .digest("hex");
const raw =
  rpc.raw as RpcRawTransaction;
    /* =====================
   RPC AUDIT FIELDS
===================== */

const network =
  tx.network ??
  "PI_TESTNET";

const expectedSender =
  tx.fromAddress;

const expectedMemo =
  piPaymentId;

const memoValue =
  raw?.envelopeJson
    ?.tx
    ?.tx
    ?.memo?.text ??
  raw?.envelopeJson
    ?.tx
    ?.tx
    ?.memo?.id ??
  raw?.envelopeJson
    ?.tx
    ?.tx
    ?.memo?.hash ??
  null;

const memoFound =
  memoValue !== null;

const memoMatch =
  memoValue ===
  expectedMemo;

const senderMatch =
  rpc.sender?.toLowerCase() ===
  expectedSender.toLowerCase();

const verificationMethod =
  "RPC_GET_TRANSACTION_V6";

const feeStroops =
  raw?.resultJson?.fee_charged
    ? Number(
        raw.resultJson
          .fee_charged
      )
    : null;

const feePi =
  feeStroops !== null
    ? feeStroops /
      10000000
    : null;

const verificationSnapshot =
{
  txid,

  ledger:
    rpc.ledger,

  status:
    rpc.txStatus,

  amount:
    rpc.amount,

  sender:
    rpc.sender,

  receiver:
    rpc.receiver,

  memo:
    memoValue,
};
vlog(
  "RPC_VERIFY_RESULT",
  rpc
);
    console.log(
  "[DEBUG_RPC_RAW_EXISTS]",
  !!rpc.raw
);

console.log(
  "[DEBUG_RPC_RAW_TYPE]",
  typeof rpc.raw
);
    
    await insertA2URpcLog({
  withdrawalId: withdrawal.id,
  piPaymentId,

  txid,
  verified: rpc.verified,

  stage: rpc.stage,
  reason: rpc.reason,

  amount: rpc.amount,
  expectedAmount: Number(
    withdrawal.amount
  ),

  sender: rpc.sender,
  receiver: rpc.receiver,

  expectedReceiver:
    withdrawal.withdraw_wallet,
  amountMatch:
  rpc.amount !== null &&
  Number(
    withdrawal.amount
  ) === rpc.amount,

  receiverMatch:
    rpc.receiver?.toLowerCase() ===
    withdrawal.withdraw_wallet.toLowerCase(),

  senderMatch,

  verificationHash,

  ledger: rpc.ledger,

  txStatus: rpc.txStatus,
  chainReference: rpc.chainReference,

  rpcReachable: rpc.rpcReachable,
  confirmed: rpc.confirmed,

  parseLayer: rpc.parseLayer,

  hasMeta: rpc.hasMeta,
  hasEvents: rpc.hasEvents,

  senderFound: rpc.senderFound,
  receiverFound: rpc.receiverFound,
  amountFound: rpc.amountFound,

  feeStroops:
  raw?.resultJson?.fee_charged
    ? Number(raw.resultJson.fee_charged)
    : null,

latestLedger:
  raw?.latestLedger ?? null,

oldestLedger:
  raw?.oldestLedger ?? null,

applicationOrder:
  raw?.applicationOrder ?? null,

sourceAccount:
  raw?.envelopeJson
    ?.tx
    ?.tx
    ?.source_account ??
  rpc.sender,

memoType:
  raw?.envelopeJson
    ?.tx
    ?.tx
    ?.memo?.text
    ? "text"
    : raw?.envelopeJson
        ?.tx
        ?.tx
        ?.memo?.id
      ? "id"
      : raw?.envelopeJson
          ?.tx
          ?.tx
          ?.memo?.hash
        ? "hash"
        : null,

  memo: rpc.memo,
network,
expectedSender,
expectedMemo,
memoMatch,
memoFound,
verificationVersion:
  1,
verificationMethod,
feePi,
verificationSnapshot,
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

createdAt:
  rpc.createdAt,

payload:
  rpc.raw,
});
vlog(
  "RPC_LOG_SAVED",
  {
    withdrawalId:
      withdrawal.id,
    txid,
  }
);

if (!rpc.verified) {
  throw new Error(
    `RPC_VERIFY_FAILED:${rpc.reason}`
  );
}
vlog(
  "SUBMIT_DONE",
  {
    txid,
  }
);
await completeA2UPayment(
  piPaymentId,
  txid
);
    vlog(
  "COMPLETE_DONE",
  {
    piPaymentId,
    txid,
  }
);

await markWithdrawalCompleted(
  withdrawal.id,
  txid,
  rpc.ledger ??
    tx.ledger,
  rpc.memo ??
    tx.memo,
  tx.fee,
  rpc.sender ??
    tx.fromAddress,
  rpc.receiver ??
    tx.toAddress,
  tx.network
);

vlog(
  "MARK_COMPLETED_DONE",
  {
    withdrawalId:
      withdrawal.id,
    txid,
  }
);

    /* =====================
       RESPONSE
    ===================== */

    vlog("SUCCESS");

    return NextResponse.json({
  success: true,
  withdrawal_id:
    withdrawal.id,
  pi_payment_id:
    piPaymentId,
  txid,
  status:
    "COMPLETED",
});
  } catch (error) {
    console.error(
      "[ADMIN_PAY_WITHDRAW][ERROR]",
      error
    );

    return NextResponse.json(
      {
        error: "PAY_FAILED",
      },
      {
        status: 500,
      }
    );
  }
}

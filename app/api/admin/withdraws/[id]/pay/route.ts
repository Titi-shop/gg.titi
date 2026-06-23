import { NextResponse } from "next/server";
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

export const runtime = "nodejs";
export const dynamic =
  "force-dynamic";

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
      withdrawal.status !==
      "APPROVED"
    ) {
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
  "SUBMIT_DONE",
  {
    txid,
  }
);
await completeA2UPayment(
  piPaymentId,
  tx.txid
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
  tx.txid,
  tx.ledger,
  tx.memo,
  tx.fee,
  tx.fromAddress,
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

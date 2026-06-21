// =====================================================
// app/api/wallet/withdraw/route.ts
// =====================================================

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getUserFromBearer,
} from "@/lib/auth/getUserFromBearer";

import {
  createWalletWithdrawal,
} from "@/lib/db/wallet/wallet.withdraw";

export const runtime =
  "nodejs";

/* =====================================================
   TYPES
===================================================== */

type RequestBody = {
  amount?: unknown;
  withdrawWallet?: unknown;
};

/* =====================================================
   POST
===================================================== */

export async function POST(
  request: NextRequest
) {

  try {

    /* =================================================
       AUTH
    ================================================= */

    const auth =
      await getUserFromBearer();

    if (!auth) {

      return NextResponse.json(
        {
          error:
            "UNAUTHORIZED",
        },
        {
          status: 401,
        }
      );
    }

    const userId =
      auth.userId;

    /* =================================================
       BODY
    ================================================= */

    const body:
      unknown =
        await request.json();

    if (
      typeof body !==
        "object" ||
      body === null
    ) {

      return NextResponse.json(
        {
          error:
            "INVALID_BODY",
        },
        {
          status: 400,
        }
      );
    }

    const data =
      body as RequestBody;

    /* =================================================
       AMOUNT
    ================================================= */

    const amount =
      Number(
        data.amount
      );

    if (
      Number.isNaN(
        amount
      ) ||
      amount <= 0
    ) {

      return NextResponse.json(
        {
          error:
            "INVALID_AMOUNT",
        },
        {
          status: 400,
        }
      );
    }

    /* =================================================
       WALLET
    ================================================= */

    const withdrawWallet =
      typeof data.withdrawWallet ===
      "string"
        ? data.withdrawWallet
            .trim()
        : "";

    if (
      !withdrawWallet
    ) {

      return NextResponse.json(
        {
          error:
            "INVALID_WALLET",
        },
        {
          status: 400,
        }
      );
    }

    /* =================================================
       CREATE
    ================================================= */

    const withdrawal =
      await createWalletWithdrawal({
        userId,

        amount,

        withdrawWallet,
      });

    /* =================================================
       SUCCESS
    ================================================= */

    return NextResponse.json({
      success: true,

      withdrawalId:
        withdrawal.id,
    });

  } catch (
    error
  ) {

    console.error(
      "[WALLET][WITHDRAW][API]",
      error
    );

    return NextResponse.json(
      {
        error:
          "INTERNAL_ERROR",
      },
      {
        status: 500,
      }
    );
  }
}

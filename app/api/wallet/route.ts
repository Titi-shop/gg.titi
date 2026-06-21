import {
  NextResponse,
} from "next/server";

import {
  requireAuth,
} from "@/lib/auth/guard";

import {
  getWalletByUserId,
} from "@/lib/db/wallet";

export const runtime =
  "nodejs";

export async function GET() {

  try {

    const auth =
      await requireAuth();

    if (!auth.ok) {
      return auth.response;
    }

    const wallet =
      await getWalletByUserId(
        auth.userId
      );

    return NextResponse.json({
      balance:
        wallet.balance,

      availableBalance:
        wallet.availableBalance,

      pendingBalance:
        wallet.pendingBalance,

      frozenBalance:
        wallet.frozenBalance,
    });

  } catch (error) {

    console.error(
      "[WALLET][GET_FAILED]",
      {
        error:
          error instanceof Error
            ? error.message
            : "UNKNOWN_ERROR",
      }
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

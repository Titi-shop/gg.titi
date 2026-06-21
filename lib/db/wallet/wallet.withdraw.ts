
// =====================================================
// lib/db/wallet/wallet.withdraw.ts
// =====================================================

import {
  randomUUID,
} from "crypto";

import {
  withTransaction,
} from "@/lib/db";

import {
  debitWallet,
} from "./wallet.balance";

import {
  createWalletJournal,
} from "./wallet.journal";

import type {
  WalletClient,
} from "./wallet.types";

/* =====================================================
   TYPES
===================================================== */

type CreateWalletWithdrawalInput =
  {
    userId: string;

    amount: number;

    withdrawWallet: string;
  };

type WithdrawalRow = {
  id: string;
};

/* =====================================================
   CREATE WITHDRAWAL
===================================================== */

export async function createWalletWithdrawal(
  params: CreateWalletWithdrawalInput
): Promise<WithdrawalRow> {

  /* ===================================================
     VALIDATE
  =================================================== */

  if (
    typeof params.userId !==
      "string" ||
    !params.userId
  ) {
    throw new Error(
      "INVALID_USER_ID"
    );
  }

  if (
  Number.isNaN(params.amount) ||
  params.amount <= 0 ||
  params.amount > 1000000
) {
  throw new Error(
    "INVALID_AMOUNT"
  );
}

  if (
    typeof params.withdrawWallet !==
      "string" ||
    !params.withdrawWallet.trim()
  ) {
    throw new Error(
      "INVALID_WITHDRAW_WALLET"
    );
  }

  /* ===================================================
     TX
  =================================================== */

  return withTransaction(
    async (
      client
    ) => {

      const withdrawalId =
        randomUUID();

      /* ===============================================
         DEBIT WALLET
      =============================================== */

      await debitWallet({
        client:
          client as WalletClient,

        userId:
          params.userId,

        amount:
          params.amount,
      });

      /* ===============================================
         INSERT WITHDRAWAL
      =============================================== */

      const withdrawRs =
  await client.query(
    `
    INSERT INTO wallet_withdrawals (
      id,
      user_id,
      amount,
      currency,
      withdraw_wallet,
      status,
      requested_at
    )
    VALUES (
      $1,$2,$3,
      'PI',
      $4,
      'PENDING',
      NOW()
    )
    RETURNING id
    `,
    [
      withdrawalId,
      params.userId,
      params.amount,
      params.withdrawWallet,
    ]
  );

if (withdrawRs.rowCount !== 1) {
  throw new Error(
    "WITHDRAWAL_CREATE_FAILED"
  );
}

      /* ===============================================
         JOURNAL
      =============================================== */

      await createWalletJournal({
        client:
          client as WalletClient,

        ownerId:
          params.userId,

        ownerType:
          "SELLER",

        refId:
          withdrawalId,

        refTable:
          "wallet_withdrawals",

        entryType:
          "SELLER_WITHDRAW",

        direction:
          "DEBIT",

        amount:
          params.amount,

        note:
          "Wallet withdrawal request",
      });

      /* ===============================================
         DONE
      =============================================== */

      return {
        id:
          withdrawalId,
      };
    }
  );
}

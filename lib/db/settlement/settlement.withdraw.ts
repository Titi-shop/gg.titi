// =====================================================
// lib/db/settlement/settlement.withdraw.ts
// =====================================================

import {
  query,
} from "@/lib/db";

import {
  randomUUID,
} from "crypto";

import type {
  WithdrawSellerInput,
} from "@/lib/payments/types";

import {
  createSettlementJournalOnce,
} from "./settlement.journal";

/* =====================================================
   SELLER WITHDRAW
===================================================== */

export async function withdrawSeller(
  input: WithdrawSellerInput
): Promise<void> {

  /* ===================================================
     1. LOAD CREDIT
  =================================================== */

  const rs =
    await query<{
      available_amount: string;
      withdrawn_amount: string;
      withdraw_count: number;
    }>(
      `
      SELECT
        available_amount,
        withdrawn_amount,
        withdraw_count

      FROM seller_credits

      WHERE id = $1

      LIMIT 1
      `,
      [
        input.sellerCreditId,
      ]
    );

  if (!rs.rows.length) {
    throw new Error(
      "SELLER_CREDIT_NOT_FOUND"
    );
  }

  const available =
    Number(
      rs.rows[0]
        .available_amount
    );

  if (
    available < input.amount
  ) {
    throw new Error(
      "INSUFFICIENT_SELLER_BALANCE"
    );
  }

  /* ===================================================
     2. CREATE WITHDRAWAL
  =================================================== */

  await query(
    `
    INSERT INTO seller_withdrawals (

      id,

      seller_id,
      seller_credit_id,

      amount,
      currency,

      withdraw_wallet,

      txid,

      status,

      requested_at,
      completed_at

    )
    VALUES (

      $1,

      $2,
      $3,

      $4,
      'PI',

      $5,

      $6,

      'SENT',

      NOW(),
      NOW()
    )
    `,
    [
      randomUUID(),

      input.sellerId,
      input.sellerCreditId,

      input.amount,

      input.withdrawWallet,

      input.txid ??
        null,
    ]
  );

  /* ===================================================
     3. UPDATE CREDIT
  =================================================== */

  await query(
    `
    UPDATE seller_credits

    SET

      withdrawn_amount =
        withdrawn_amount + $2,

      available_amount =
        available_amount - $2,

      withdraw_count =
        withdraw_count + 1,

      last_withdraw_at =
        NOW(),

      chain_txid =
        COALESCE(
          $3,
          chain_txid
        ),

      status =
        CASE
          WHEN available_amount - $2 <= 0
          THEN 'WITHDRAWN'

          ELSE 'PARTIAL_WITHDRAWN'
        END,

      ledger_version =
        ledger_version + 1,

      updated_at =
        NOW()

    WHERE id = $1
    `,
    [
      input.sellerCreditId,

      input.amount,

      input.txid ??
        null,
    ]
  );

  /* ===================================================
     4. JOURNAL
  =================================================== */

  await createSettlementJournalOnce({
    ownerId:
      input.sellerId,

    ownerType:
      "SELLER",

    refId:
      input.sellerCreditId,

    refTable:
      "seller_withdrawals",

    entryType:
      "SELLER_WITHDRAW",

    direction:
      "DEBIT",

    amount:
      input.amount,

    note:
      "Seller withdrawal processed",
  });
}

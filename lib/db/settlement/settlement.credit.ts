// =====================================================
// lib/db/settlement/settlement.credit.ts
// =====================================================

import {
  query,
} from "@/lib/db";

import {
  randomUUID,
} from "crypto";

import type {
  CreditSellerInput,
} from "@/lib/payments/types";

import {
  makeEventHash,
} from "./settlement.utils";

import {
  createSettlementEventOnce,
} from "./settlement.event";

import {
  createSettlementJournalOnce,
} from "./settlement.journal";

/* =====================================================
   CREDIT SELLER
===================================================== */

export async function creditSeller(
  input: CreditSellerInput
): Promise<string> {

  console.log(
    "[SETTLEMENT][CREDIT] START",
    {
      escrowId:
        input.escrowId,

      sellerId:
        input.sellerId,

      amount:
        input.amount,
    }
  );

  try {

    /* ===================================================
       CHECK EXISTED
    =================================================== */

    const existed =
      await query<{ id: string }>(
        `
        SELECT id
        FROM seller_credits
        WHERE escrow_id = $1
        LIMIT 1
        `,
        [
          input.escrowId,
        ]
      );

    if (existed.rows.length) {

      console.log(
        "[SETTLEMENT][CREDIT] EXISTS",
        {
          escrowId:
            input.escrowId,

          creditId:
            existed.rows[0].id,
        }
      );

      return existed.rows[0].id;
    }

    /* ===================================================
       CREATE CREDIT
    =================================================== */

    const creditId =
      randomUUID();

    const auditHash =
      makeEventHash({
        escrowId:
          input.escrowId,

        sellerId:
          input.sellerId,

        amount:
          input.amount,

        paymentIntentId:
          input.paymentIntentId,

        orderId:
          input.orderId,

        piPaymentId:
          input.piPaymentId,
      });

    console.log(
      "[SETTLEMENT][CREDIT] INSERT_START",
      {
        creditId,
        escrowId:
          input.escrowId,
      }
    );

    await query(
      `
      INSERT INTO seller_credits (

        id,

        seller_id,
        escrow_id,

        payment_intent_id,
        order_id,

        amount,

        withdrawn_amount,
        reversed_amount,

        frozen_amount,
        available_amount,

        currency,

        status,

        pi_payment_id,
        chain_txid,

        credit_source,

        ledger_version,

        audit_hash,

        lock_id,
        locked_at,
        lock_source,

        hold_reason,
        release_note,
        manual_review_reason,

        withdraw_count,
        last_withdraw_at,

        frozen_at,
        released_at,
        reversed_at,

        created_at,
        updated_at

      )
      VALUES (

        $1,

        $2,
        $3,

        $4,
        $5,

        $6,

        0,
        0,

        $6,
        0,

        'PI',

        'FROZEN',

        $7,
        NULL,

        'ORDER_PAYMENT',

        1,

        $8,

        NULL,
        NULL,
        NULL,

        'ESCROW_PENDING',
        NULL,
        NULL,

        0,
        NULL,

        NOW(),
        NULL,
        NULL,

        NOW(),
        NOW()
      )
      `,
      [
        creditId,

        input.sellerId,
        input.escrowId,

        input.paymentIntentId ??
          null,

        input.orderId ??
          null,

        input.amount,

        input.piPaymentId ??
          null,

        auditHash,
      ]
    );

    console.log(
      "[SETTLEMENT][CREDIT] INSERT_DONE",
      {
        creditId,
        escrowId:
          input.escrowId,
      }
    );

    /* ===================================================
       EVENT
    =================================================== */

    await createSettlementEventOnce({
      escrowId:
        input.escrowId,

      type:
        "SELLER_CREDITED",

      source:
        "ledger",

      reason:
        "SELLER_BALANCE_GRANTED",

      metadata:
        input,
    });

    console.log(
      "[SETTLEMENT][CREDIT] EVENT_DONE",
      {
        escrowId:
          input.escrowId,
      }
    );

    /* ===================================================
       JOURNAL
    =================================================== */
await createSettlementJournalOnce({
  ownerId: input.sellerId,
  ownerType: "SELLER",

  refId: creditId,
  refTable: "seller_credits",

  entryType: "SELLER_CREDIT",
  direction: "CREDIT",

  amount: input.amount,

  note: "Seller escrow balance frozen",

  eventHash: auditHash,

  metadata: {
    escrowId: input.escrowId,
    paymentIntentId: input.paymentIntentId,
    orderId: input.orderId,
    piPaymentId: input.piPaymentId,
    sellerId: input.sellerId,
    amount: input.amount,
  },

  createdBy: input.sellerId,
});
    console.log(
      "[SETTLEMENT][CREDIT] JOURNAL_DONE",
      {
        creditId,
      }
    );

    console.log(
      "[SETTLEMENT][CREDIT] SUCCESS",
      {
        creditId,
      }
    );

    return creditId;

  } catch (error) {

    console.error(
      "[SETTLEMENT][CREDIT][FATAL]",
      {
        escrowId:
          input.escrowId,

        sellerId:
          input.sellerId,

        error,
      }
    );

    throw error;
  }
}

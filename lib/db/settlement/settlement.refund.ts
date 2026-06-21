// =====================================================
// lib/db/settlement/settlement.refund.ts
// =====================================================

import {
  query,
} from "@/lib/db";

import {
  randomUUID,
} from "crypto";

import type {
  RefundBuyerInput,
} from "@/lib/payments/types";

import {
  createSettlementEventOnce,
} from "./settlement.event";

import {
  createSettlementJournalOnce,
} from "./settlement.journal";

/* =====================================================
   REFUND BUYER
===================================================== */

export async function refundBuyer(
  input: RefundBuyerInput
): Promise<void> {

  /* ===================================================
     1. CREATE REFUND LEDGER
  =================================================== */

  await query(
    `
    INSERT INTO buyer_refund_ledger (

      id,

      escrow_id,
      buyer_id,

      amount,

      reason,

      status,

      refund_txid,
      pi_payment_id,

      refund_source,

      approved_by,

      processed_at,
      created_at

    )
    VALUES (

      $1,

      $2,
      $3,

      $4,

      $5,

      'REFUNDED',

      $6,
      $7,

      'SYSTEM',

      $8,

      NOW(),
      NOW()
    )
    `,
    [
      randomUUID(),

      input.escrowId,
      input.buyerId,

      input.amount,

      input.reason ??
        null,

      input.refundTxid ??
        null,

      input.piPaymentId ??
        null,

      input.approvedBy ??
        null,
    ]
  );

  /* ===================================================
     2. UPDATE ESCROW
  =================================================== */

  await query(
    `
    UPDATE escrow_entries

    SET
      status = 'REFUNDED',

      refunded_amount =
        refunded_amount + $2,

      escrow_version =
        escrow_version + 1,

      updated_at =
        NOW()

    WHERE id = $1
    `,
    [
      input.escrowId,
      input.amount,
    ]
  );

  /* ===================================================
     3. EVENT
  =================================================== */

  await createSettlementEventOnce({
    escrowId:
      input.escrowId,

    type:
      "BUYER_REFUNDED",

    source:
      "refund_engine",

    reason:
      input.reason ??
      "BUYER_REFUND",

    metadata:
      input,
  });

  /* ===================================================
     4. JOURNAL
  =================================================== */

  await createSettlementJournalOnce({
    ownerId:
      input.buyerId,

    ownerType:
      "BUYER",

    refId:
      input.escrowId,

    refTable:
      "buyer_refund_ledger",

    entryType:
      "BUYER_REFUND",

    direction:
      "CREDIT",

    amount:
      input.amount,

    note:
      "Buyer refunded from escrow",
  });
}

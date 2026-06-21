// =====================================================
// lib/db/settlement/settlement.escrow.ts
// =====================================================

import {
  query,
} from "@/lib/db";

import {
  randomUUID,
} from "crypto";

import type {
  CreateEscrowInput,
} from "@/lib/payments/types";

import {
  createSettlementEventOnce,
} from "./settlement.event";
import { makeEventHash } from "./settlement.utils";

import {
  createSettlementJournalOnce,
} from "./settlement.journal";

/* =====================================================
   CREATE ESCROW
===================================================== */

export async function createEscrow(
  input: CreateEscrowInput
): Promise<string> {

  const existed =
    await query<{ id: string }>(
      `
      SELECT id

      FROM escrow_entries

      WHERE payment_intent_id = $1

      LIMIT 1
      `,
      [
        input.paymentIntentId,
      ]
    );

  let escrowId: string;
  if (existed.rows.length) {
    escrowId =
      existed.rows[0].id;
  } else {

    escrowId =
      randomUUID();
    await query(
      `
      INSERT INTO escrow_entries (
        id,
        payment_intent_id,
        order_id,

        buyer_id,
        seller_id,

        amount,

        released_amount,
        refunded_amount,

        currency,

        status,
        release_status,

        txid,
        pi_payment_id,

        held_at,

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

        'PI',

        'PAID',
        'HOLD',

        $7,
        $8,

        NOW(),

        NOW(),
        NOW()

      )
      `,
      [
        escrowId,

        input.paymentIntentId,

        input.orderId,

        input.buyerId,
        input.sellerId,

        input.amount,

        input.txid,
        input.piPaymentId,
      ]
    );
  }
const journalHash = makeEventHash({
  type: "ESCROW_HOLD",

  escrowId,

  paymentIntentId:
    input.paymentIntentId,

  orderId:
    input.orderId,

  buyerId:
    input.buyerId,

  sellerId:
    input.sellerId,

  amount:
    input.amount,

  txid:
    input.txid,

  piPaymentId:
    input.piPaymentId,
});
  /* ===================================================
     EVENT
  =================================================== */

  await createSettlementEventOnce({
    escrowId,

    type:
      "ESCROW_CREATED",

    source:
      "system",

    reason:
      "PAYMENT_CAPTURED",

    metadata:
      input,
  });

  /* ===================================================
     JOURNAL
  =================================================== */

  await createSettlementJournalOnce({
  ownerId: input.buyerId,
  ownerType: "BUYER",
  refId: escrowId,
  refTable: "escrow_entries",
  entryType: "ESCROW_HOLD",
  direction: "DEBIT",
  amount: input.amount,
  note: "Buyer funds moved into escrow",
  eventHash: journalHash,
  metadata: {
    escrowId,
    paymentIntentId: input.paymentIntentId,
    orderId: input.orderId,
    buyerId: input.buyerId,
    sellerId: input.sellerId,
    amount: input.amount,
    txid: input.txid,
    piPaymentId: input.piPaymentId,
  },
  createdBy: input.buyerId,
});

return escrowId;
}

/* =====================================================
   RELEASE ESCROW
===================================================== */

export async function releaseEscrow(
  escrowId: string
): Promise<void> {
  
  const rs =
    await query<{
      amount: string;
      release_status: string;
    }>(
      `
      SELECT
        amount,
        release_status

      FROM escrow_entries

      WHERE id = $1

      LIMIT 1
      `,
      [escrowId]
    );

  if (!rs.rows.length) {
    throw new Error(
      "ESCROW_NOT_FOUND"
    );
  }

  if (
    rs.rows[0]
      .release_status ===
    "RELEASED"
  ) {
    return;
  }

  const total =
    Number(
      rs.rows[0].amount
    );

  await query(
    `
    UPDATE escrow_entries

    SET

      status =
        'SETTLED',

      release_status =
        'RELEASED',

      released_amount =
        $2,

      released_at =
        NOW(),

      escrow_version =
        escrow_version + 1,

      updated_at =
        NOW()

    WHERE id = $1
    `,
    [
      escrowId,
      total,
    ]
  );

  await createSettlementEventOnce({
    escrowId,

    type:
      "ESCROW_RELEASED",

    source:
      "ledger",

    reason:
      "ESCROW_TO_SELLER",
  });
}

/* =====================================================
   PI VERIFIED
===================================================== */

export async function markPiVerified(
  escrowId: string
): Promise<void> {

  await createSettlementEventOnce({
    escrowId,

    type:
      "PI_VERIFIED",

    source:
      "pi_api",

    reason:
      "PI_PAYMENT_VERIFIED",
  });
}

/* =====================================================
   RPC VERIFIED
===================================================== */

export async function markRpcVerified(
  escrowId: string
): Promise<void> {

  await createSettlementEventOnce({
    escrowId,

    type:
      "RPC_VERIFIED",

    source:
      "rpc",

    reason:
      "CHAIN_TX_VERIFIED",
  });
}

/* =====================================================
   LINK ORDER
===================================================== */

export async function linkOrder(
  escrowId: string,
  orderId: string
): Promise<void> {

  await createSettlementEventOnce({
    escrowId,

    type:
      "ORDER_LINKED",

    source:
      "order_engine",

    reason:
      "ORDER_CONNECTED",

    metadata: {
      orderId,
    },
  });
}

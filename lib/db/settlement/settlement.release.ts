// =====================================================
// lib/db/settlement/settlement.release.ts
// =====================================================

import type {
  EscrowReleaseRow,
  ReleaseEscrowFlowInput,
} from "@/lib/payments/types";

import {
  createSettlementEventOnce,
} from "./settlement.event";

import {
  createSettlementJournalOnce,
} from "./settlement.journal";

/* =====================================================
   DB CLIENT TYPE
===================================================== */

type TransactionClient = {
  query: <T>(
    sql: string,
    params?: unknown[]
  ) => Promise<{
    rows: T[];
    rowCount: number | null;
  }>;
};

/* =====================================================
   FIND RELEASABLE ESCROWS
===================================================== */

export async function findReleasableEscrows(
  client: TransactionClient
): Promise<EscrowReleaseRow[]> {

  console.log(
    "[SETTLEMENT][RELEASE] FIND_RELEASABLE_START"
  );

  const { rows } =
    await client.query<EscrowReleaseRow>(
      `
      SELECT
  id,
  order_id,
  payment_intent_id,
  seller_id,
  amount,
  status,
  release_status,
  release_after
FROM escrow_entries

      WHERE
        release_status = 'HOLD'
        AND status = 'PAID'
        AND release_after IS NOT NULL
        AND release_after <= NOW()
      FOR UPDATE SKIP LOCKED
      `
    );

  console.log(
    "[SETTLEMENT][RELEASE] FIND_RELEASABLE_DONE",
    {
      total: rows.length,
    }
  );

  return rows;
}

/* =====================================================
   RELEASE ESCROW FLOW
===================================================== */

export async function releaseEscrowFlow(
  input: ReleaseEscrowFlowInput
): Promise<void> {

  const {
    client,
    escrow,
  } = input;

  console.log(
    "[SETTLEMENT][RELEASE] FLOW_START",
    {
      escrowId:
        escrow.id,

      orderId:
        escrow.order_id,

      sellerId:
        escrow.seller_id,

      amount:
        escrow.amount,
    }
  );

  const amount =
    Number(escrow.amount);

  if (
    Number.isNaN(amount) ||
    amount <= 0
  ) {

    console.error(
      "[SETTLEMENT][RELEASE] INVALID_AMOUNT",
      {
        escrowId:
          escrow.id,

        rawAmount:
          escrow.amount,
      }
    );

    throw new Error(
      "INVALID_ESCROW_AMOUNT"
    );
  }

  /* ===================================================
     1. RELEASE ESCROW
  =================================================== */

  console.log(
    "[SETTLEMENT][RELEASE] ESCROW_UPDATE_START",
    {
      escrowId:
        escrow.id,
    }
  );

  const escrowUpdate =
  await client.query(
    `
    UPDATE escrow_entries

    SET
      status = 'SETTLED',

      release_status =
        'RELEASED',

      released_amount =
        amount,

      released_at =
        NOW(),

      updated_at =
        NOW(),

      escrow_version =
        escrow_version + 1

    WHERE id = $1
      AND release_status = 'HOLD'
    `,
    [
      escrow.id,
    ]
  );

/* ===================================================
   IDEMPOTENT GUARD
=================================================== */

if (
  escrowUpdate.rowCount !== 1
) {

  console.warn(
    "[SETTLEMENT][RELEASE] ALREADY_RELEASED",
    {
      escrowId:
        escrow.id,

      affected:
        escrowUpdate.rowCount,
    }
  );

  return;
}

console.log(
  "[SETTLEMENT][RELEASE] ESCROW_UPDATE_DONE",
  {
    escrowId:
      escrow.id,

    affected:
      escrowUpdate.rowCount,
  }
);

  const sellerCreditUpdate =
    await client.query(
      `
      UPDATE seller_credits

SET
  status = 'AVAILABLE',

  available_amount =
    available_amount + amount,

  frozen_amount =
    frozen_amount - amount,

  released_at = NOW(),
  updated_at = NOW(),
  ledger_version = ledger_version + 1

WHERE escrow_id = $1
  AND status = 'FROZEN'
  AND frozen_amount >= amount
      `,
      [
        escrow.id,
      ]
    );
console.log(
  "[SETTLEMENT][RELEASE] CREDIT_RELEASE_DONE",
  {
    escrowId:
      escrow.id,

    affected:
      sellerCreditUpdate.rowCount,
  }
);

/* ===================================================
   IDEMPOTENT CREDIT GUARD
=================================================== */

if (
  sellerCreditUpdate.rowCount !== 1
) {

  throw new Error(
    "SELLER_CREDIT_RELEASE_FAILED"
  );
}

  /* ===================================================
     3. ENSURE WALLET
  =================================================== */

  console.log(
    "[SETTLEMENT][RELEASE] ENSURE_WALLET_START",
    {
      sellerId:
        escrow.seller_id,
    }
  );

  await client.query(
    `
    INSERT INTO wallets (
      user_id,
      balance,
      available_balance,
      pending_balance,
      frozen_balance,
      wallet_version,
      created_at,
      updated_at
    )
    VALUES (
      $1,
      0,
      0,
      0,
      0,
      1,
      NOW(),
      NOW()
    )

    ON CONFLICT (user_id)
    DO NOTHING
    `,
    [
      escrow.seller_id,
    ]
  );

  console.log(
    "[SETTLEMENT][RELEASE] ENSURE_WALLET_DONE",
    {
      sellerId:
        escrow.seller_id,
    }
  );

  /* ===================================================
     4. CREDIT WALLET
  =================================================== */

  console.log(
    "[SETTLEMENT][RELEASE] WALLET_CREDIT_START",
    {
      sellerId:
        escrow.seller_id,

      amount,
    }
  );

  const walletUpdate =
    await client.query(
      `
      UPDATE wallets

      SET

        balance =
          balance + $1,

        available_balance =
          available_balance + $1,

        wallet_version =
          wallet_version + 1,

        last_credit_at =
          NOW(),

        updated_at =
          NOW()

      WHERE user_id = $2
      `,
      [
        amount,
        escrow.seller_id,
      ]
    );

  console.log(
    "[SETTLEMENT][RELEASE] WALLET_CREDIT_DONE",
    {
      sellerId:
        escrow.seller_id,

      affected:
        walletUpdate.rowCount,
    }
  );
if (walletUpdate.rowCount !== 1) {
  throw new Error(
    "WALLET_CREDIT_FAILED"
  );
}
  /* ===================================================
     5. JOURNAL
  =================================================== */

  console.log(
    "[SETTLEMENT][RELEASE] JOURNAL_START",
    {
      escrowId:
        escrow.id,
    }
  );

  await createSettlementJournalOnce(
  {
    ownerId:
      escrow.seller_id,

    ownerType:
      "SELLER",

    refId:
      escrow.id,

    refTable:
      "escrow_entries",

    entryType:
      "SELLER_ESCROW_RELEASE",

    direction:
      "CREDIT",

    amount,

    note:
      "Escrow released to seller wallet",
  },

  client
);

  console.log(
    "[SETTLEMENT][RELEASE] JOURNAL_DONE",
    {
      escrowId:
        escrow.id,
    }
  );

  /* ===================================================
     6. COMPLETE ORDER
  =================================================== */

  console.log(
    "[SETTLEMENT][RELEASE] ORDER_COMPLETE_START",
    {
      orderId:
        escrow.order_id,
    }
  );
/* ===================================================
   8. FINALIZE PAYMENT INTENT
=================================================== */

if (escrow.payment_intent_id) {

  console.log(
    "[SETTLEMENT][RELEASE] PAYMENT_INTENT_SETTLE_START",
    {
      paymentIntentId:
        escrow.payment_intent_id,
    }
  );

  const intentUpdate =
    await client.query(
      `
      UPDATE payment_intents
      SET
        settlement_state = 'SETTLED',
        settled_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
        AND settlement_state <> 'SETTLED'
      `,
      [
        escrow.payment_intent_id,
      ]
    );

  console.log(
    "[SETTLEMENT][RELEASE] PAYMENT_INTENT_SETTLE_DONE",
    {
      paymentIntentId:
        escrow.payment_intent_id,

      affected:
        intentUpdate.rowCount,
    }
  );
}
  const orderUpdate =
    await client.query(
      `
      UPDATE orders
SET
  fulfillment_status = 'completed',
  settlement_status = 'SETTLED',
  shipment_status = 'DELIVERED',
  delivery_status = 'DELIVERED',
  completed_at = NOW(),
  updated_at = NOW()
WHERE id = $1
  AND fulfillment_status <> 'completed'
      `,
      [
        escrow.order_id,
      ]
    );

  console.log(
    "[SETTLEMENT][RELEASE] ORDER_COMPLETE_DONE",
    {
      orderId:
        escrow.order_id,

      affected:
        orderUpdate.rowCount,
    }
  );

  /* ===================================================
     7. COMPLETE ORDER ITEMS
  =================================================== */

  console.log(
    "[SETTLEMENT][RELEASE] ORDER_ITEMS_COMPLETE_START",
    {
      orderId:
        escrow.order_id,
    }
  );

  const orderItemsUpdate =
    await client.query(
      `
      UPDATE order_items

      SET
        fulfillment_status =
          'completed',

        completed_at =
          NOW(),

        updated_at =
          NOW()

      WHERE order_id = $1
        AND fulfillment_status IN (
          'shipped',
          'delivered'
        )
      `,
      [
        escrow.order_id,
      ]
    );

  console.log(
    "[SETTLEMENT][RELEASE] ORDER_ITEMS_COMPLETE_DONE",
    {
      orderId:
        escrow.order_id,

      affected:
        orderItemsUpdate.rowCount,
    }
  );

  /* ===================================================
     8. EVENT
  =================================================== */

  console.log(
    "[SETTLEMENT][RELEASE] EVENT_START",
    {
      escrowId:
        escrow.id,
    }
  );

  await createSettlementEventOnce(
  {
    escrowId:
      escrow.id,

    type:
      "AUTO_RELEASE",

    source:
      "system",

    reason:
      "ESCROW_AUTO_RELEASED",

    metadata: {
      orderId:
        escrow.order_id,

      sellerId:
        escrow.seller_id,

      amount,
    },
  },

  client
);

  console.log(
    "[SETTLEMENT][RELEASE] EVENT_DONE",
    {
      escrowId:
        escrow.id,
    }
  );

  /* ===================================================
     COMPLETE
  =================================================== */

  console.log(
    "[SETTLEMENT][RELEASE] FLOW_SUCCESS",
    {
      escrowId:
        escrow.id,

      orderId:
        escrow.order_id,

      sellerId:
        escrow.seller_id,

      amount,
    }
  );
}

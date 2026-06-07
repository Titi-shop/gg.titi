import { query } from "@/lib/db";
import { randomUUID, createHash } from "crypto";

/* =========================================================
   TYPES
========================================================= */

type CreateEscrowInput = {
  paymentIntentId: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  txid: string;
  piPaymentId: string;
};

type CreditSellerInput = {
  escrowId: string;
  sellerId: string;
  amount: number;
  piPaymentId?: string;
};

type RefundBuyerInput = {
  escrowId: string;
  buyerId: string;
  amount: number;
  reason?: string;
  refundTxid?: string;
  piPaymentId?: string;
  approvedBy?: string | null;
};

type WithdrawSellerInput = {
  sellerCreditId: string;
  sellerId: string;
  amount: number;
  withdrawWallet: string;
  txid?: string;
};

/* =========================================================
   HASH
========================================================= */

function makeEventHash(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

/* =========================================================
   CLASS
========================================================= */

export class SettlementLedgerV3 {
  /* =====================================================
     CREATE ESCROW ROOT (IDEMPOTENT)
  ===================================================== */

  static async createEscrow(input: CreateEscrowInput): Promise<string> {
    const existed = await query<{ id: string }>(
      `
      SELECT id
      FROM escrow_entries
      WHERE payment_intent_id = $1
      LIMIT 1
      `,
      [input.paymentIntentId]
    );

    let escrowId: string;

    if (existed.rows.length) {
      escrowId = existed.rows[0].id;
    } else {
      escrowId = randomUUID();

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
          $1,$2,$3,$4,$5,$6,
          0,0,
          'PI',
          'PAID',
          'HOLD',
          $7,$8,
          now(),
          now(),
          now()
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

    await this.eventOnce(
      escrowId,
      "ESCROW_CREATED",
      "system",
      "PAYMENT_CAPTURED",
      input
    );

    await this.journalOnce({
      ownerId: input.buyerId,
      ownerType: "BUYER",
      refId: escrowId,
      refTable: "escrow_entries",
      entryType: "ESCROW_HOLD",
      direction: "DEBIT",
      amount: input.amount,
      note: "Buyer funds moved into escrow",
    });

    return escrowId;
  }

  /* =====================================================
     PI VERIFIED
  ===================================================== */

  static async markPiVerified(escrowId: string) {
    await this.eventOnce(
      escrowId,
      "PI_VERIFIED",
      "pi_api",
      "PI_PAYMENT_VERIFIED"
    );
  }

  /* =====================================================
     RPC VERIFIED
  ===================================================== */

  static async markRpcVerified(escrowId: string) {
    await this.eventOnce(
      escrowId,
      "RPC_VERIFIED",
      "rpc",
      "CHAIN_TX_VERIFIED"
    );
  }

  /* =====================================================
     LINK ORDER
  ===================================================== */

  static async linkOrder(escrowId: string, orderId: string) {
    await this.eventOnce(
      escrowId,
      "ORDER_LINKED",
      "order_engine",
      "ORDER_CONNECTED",
      { orderId }
    );
  }

  /* =====================================================
     CREDIT SELLER (IDEMPOTENT)
  ===================================================== */

  static async creditSeller(input: CreditSellerInput): Promise<string> {
    const existed = await query<{ id: string }>(
      `
      SELECT id
      FROM seller_credits
      WHERE escrow_id = $1
      LIMIT 1
      `,
      [input.escrowId]
    );

    let creditId: string;

    if (existed.rows.length) {
      creditId = existed.rows[0].id;
    } else {
      creditId = randomUUID();

      await query(
        `
        INSERT INTO seller_credits (
          id,
          seller_id,
          escrow_id,
          amount,
          withdrawn_amount,
          reversed_amount,
          frozen_amount,
          available_amount,
          currency,
          status,
          pi_payment_id,
          credit_source,
          released_at,
          created_at,
          updated_at
        )
        VALUES (
          $1,$2,$3,$4,
          0,0,0,$5,
          'PI',
          'AVAILABLE',
          $6,
          'ORDER_PAYMENT',
          now(),
          now(),
          now()
        )
        `,
        [
          creditId,
          input.sellerId,
          input.escrowId,
          input.amount,
          input.amount,
          input.piPaymentId ?? null,
        ]
      );
    }

    await this.eventOnce(
      input.escrowId,
      "SELLER_CREDITED",
      "ledger",
      "SELLER_BALANCE_GRANTED",
      input
    );

    await this.journalOnce({
      ownerId: input.sellerId,
      ownerType: "SELLER",
      refId: creditId,
      refTable: "seller_credits",
      entryType: "SELLER_CREDIT",
      direction: "CREDIT",
      amount: input.amount,
      note: "Seller internal wallet credited",
    });

    return creditId;
  }

  /* =====================================================
     RELEASE ESCROW
  ===================================================== */

  static async releaseEscrow(escrowId: string) {
    const rs = await query<{ amount: string; release_status: string }>(
      `
      SELECT amount, release_status
      FROM escrow_entries
      WHERE id = $1
      LIMIT 1
      `,
      [escrowId]
    );

    if (!rs.rows.length) {
      throw new Error("ESCROW_NOT_FOUND");
    }

    if (rs.rows[0].release_status === "RELEASED") {
      return;
    }

    const total = Number(rs.rows[0].amount);

    await query(
      `
      UPDATE escrow_entries
      SET
        status = 'SETTLED',
        release_status = 'RELEASED',
        released_amount = $2,
        released_at = now(),
        escrow_version = escrow_version + 1,
        updated_at = now()
      WHERE id = $1
      `,
      [escrowId, total]
    );

    await this.eventOnce(
      escrowId,
      "ESCROW_RELEASED",
      "ledger",
      "ESCROW_TO_SELLER"
    );
  }

  /* =====================================================
     REFUND BUYER
  ===================================================== */

  static async refundBuyer(input: RefundBuyerInput) {
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
        $1,$2,$3,$4,$5,
        'REFUNDED',
        $6,$7,
        'SYSTEM',
        $8,
        now(),
        now()
      )
      `,
      [
        randomUUID(),
        input.escrowId,
        input.buyerId,
        input.amount,
        input.reason ?? null,
        input.refundTxid ?? null,
        input.piPaymentId ?? null,
        input.approvedBy ?? null,
      ]
    );

    await query(
      `
      UPDATE escrow_entries
      SET
        status = 'REFUNDED',
        refunded_amount = refunded_amount + $2,
        escrow_version = escrow_version + 1,
        updated_at = now()
      WHERE id = $1
      `,
      [input.escrowId, input.amount]
    );

    await this.eventOnce(
      input.escrowId,
      "BUYER_REFUNDED",
      "refund_engine",
      input.reason ?? "BUYER_REFUND",
      input
    );

    await this.journalOnce({
      ownerId: input.buyerId,
      ownerType: "BUYER",
      refId: input.escrowId,
      refTable: "buyer_refund_ledger",
      entryType: "BUYER_REFUND",
      direction: "CREDIT",
      amount: input.amount,
      note: "Buyer refunded from escrow",
    });
  }

  /* =====================================================
     SELLER WITHDRAW (ANTI RACE)
  ===================================================== */

  static async withdrawSeller(input: WithdrawSellerInput) {
    const rs = await query<{
      available_amount: string;
      withdrawn_amount: string;
      withdraw_count: number;
    }>(
      `
      SELECT available_amount, withdrawn_amount, withdraw_count
      FROM seller_credits
      WHERE id = $1
      LIMIT 1
      `,
      [input.sellerCreditId]
    );

    if (!rs.rows.length) {
      throw new Error("SELLER_CREDIT_NOT_FOUND");
    }

    const available = Number(rs.rows[0].available_amount);

    if (available < input.amount) {
      throw new Error("INSUFFICIENT_SELLER_BALANCE");
    }

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
        $1,$2,$3,$4,'PI',$5,$6,'SENT',now(),now()
      )
      `,
      [
        randomUUID(),
        input.sellerId,
        input.sellerCreditId,
        input.amount,
        input.withdrawWallet,
        input.txid ?? null,
      ]
    );

    await query(
      `
      UPDATE seller_credits
      SET
        withdrawn_amount = withdrawn_amount + $2,
        available_amount = available_amount - $2,
        withdraw_count = withdraw_count + 1,
        last_withdraw_at = now(),
        chain_txid = COALESCE($3, chain_txid),
        status = CASE
          WHEN available_amount - $2 <= 0 THEN 'WITHDRAWN'
          ELSE 'PARTIAL_WITHDRAWN'
        END,
        ledger_version = ledger_version + 1,
        updated_at = now()
      WHERE id = $1
      `,
      [input.sellerCreditId, input.amount, input.txid ?? null]
    );

    await this.journalOnce({
      ownerId: input.sellerId,
      ownerType: "SELLER",
      refId: input.sellerCreditId,
      refTable: "seller_withdrawals",
      entryType: "SELLER_WITHDRAW",
      direction: "DEBIT",
      amount: input.amount,
      note: "Seller withdrawal processed",
    });
  }

  /* =====================================================
     EVENT ONCE
  ===================================================== */

  static async eventOnce(
    escrowId: string,
    type: string,
    source: string,
    reason: string,
    metadata?: unknown
  ) {
    const existed = await query<{ id: string }>(
      `
      SELECT id
      FROM settlement_events
      WHERE escrow_id = $1
        AND event_type = $2
      LIMIT 1
      `,
      [escrowId, type]
    );

    if (existed.rows.length) return;

    const payload = {
      escrowId,
      type,
      source,
      reason,
      metadata: metadata ?? {},
    };

    await query(
      `
      INSERT INTO settlement_events (
        id,
        escrow_id,
        event_type,
        source,
        reason,
        metadata,
        event_hash,
        created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,now())
      `,
      [
        randomUUID(),
        escrowId,
        type,
        source,
        reason,
        JSON.stringify(metadata ?? {}),
        makeEventHash(payload),
      ]
    );
  }

  /* =====================================================
     JOURNAL ONCE
  ===================================================== */

  static async journalOnce(params: {
    ownerId: string;
    ownerType: string;
    refId: string;
    refTable: string;
    entryType: string;
    direction: string;
    amount: number;
    note?: string;
  }) {
    const existed = await query<{ id: string }>(
      `
      SELECT id
      FROM wallet_journal
      WHERE owner_id = $1
        AND ref_id = $2
        AND entry_type = $3
      LIMIT 1
      `,
      [params.ownerId, params.refId, params.entryType]
    );

    if (existed.rows.length) return;

    await query(
      `
      INSERT INTO wallet_journal (
        id,
        owner_id,
        owner_type,
        ref_id,
        ref_table,
        entry_type,
        direction,
        amount,
        currency,
        note,
        created_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,'PI',$9,now()
      )
      `,
      [
        randomUUID(),
        params.ownerId,
        params.ownerType,
        params.refId,
        params.refTable,
        params.entryType,
        params.direction,
        params.amount,
        params.note ?? null,
      ]
    );
  }
}

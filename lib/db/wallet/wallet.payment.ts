// =====================================================
// lib/db/wallet/wallet.payment.ts
// =====================================================
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
  OrderRow,
  PayWithWalletInput,
} from "./wallet.types";
function toNumberSafe(
  value: unknown
): number {
  const n =
    Number(value);
  if (Number.isNaN(n)) {
    throw new Error(
      "INVALID_NUMBER"
    );
  }
  return n;
}
export async function payWithWallet(
  params: PayWithWalletInput
) {
  return withTransaction(
    async (client) => {
      const { rows } =
        await client.query<OrderRow>(
          `
          SELECT
            total_amount,
            status
          FROM orders
          WHERE
            id = $1
            AND buyer_id = $2
          LIMIT 1
          FOR UPDATE
          `,
          [
            params.orderId,
            params.userId,
          ]
        );
      const order =
        rows[0];
      if (!order) {
        throw new Error(
          "ORDER_NOT_FOUND"
        );
      }
      if (
        order.status !==
        "pending"
      ) {
        throw new Error(
          "INVALID_ORDER_STATE"
        );
      }
      const amount =
        toNumberSafe(
          order.total_amount
        );
      /* ===========================================
         DEBIT WALLET
      =========================================== */
      await debitWallet({
        client,
        userId:
          params.userId,
        amount,
      });
      /* ===========================================
         JOURNAL
      =========================================== */
      await createWalletJournal({
        client,
        ownerId:
          params.userId,
        ownerType:
          "BUYER",
        refId:
          params.orderId,
        refTable:
          "orders",
        entryType:
          "ESCROW_HOLD",
        direction:
          "DEBIT",
        amount,
        note:
          "Wallet payment for order",
      });
      /* ===========================================
         UPDATE ORDER
      =========================================== */
      await client.query(
        `
        UPDATE orders
        SET
          status = 'paid',
          updated_at =
            NOW()
        WHERE id = $1
        `,
        [params.orderId]
      );
    }
  );
}


import { withTransaction } from "@/lib/db";
import { createOrder } from "@/lib/db/orders.create";

import {
  writePaymentAudit,
} from "@/lib/db/payments.audit";

import {
  validateFinalizePayment,
} from "@/lib/db/orders.payment.validate";

import {
  upsertPaymentReceipt,
  linkReceiptSettlement,
  linkReceiptSettlementByIds,
} from "@/lib/db/orders.payment.receipt";

import {
  upsertPiPayment,
} from "@/lib/db/orders.payment.pi-payments";

import {
  finalizePaymentIntent,
} from "@/lib/db/orders.payment.intent";

import type {
  FinalizePaidOrderParams,
  FinalizePaidOrderResult,
  PaymentIntentRow,
} from "@/lib/db/orders.payment.types";

export async function finalizePaidOrderFromIntent(
  params: FinalizePaidOrderParams & {
    intent: PaymentIntentRow;
  }
): Promise<FinalizePaidOrderResult> {
  return withTransaction(async (client) => {
    const {
      paymentIntentId,
      piPaymentId,
      txid,
      verifiedAmount,
      receiverWallet,
      piPayload,
      rpcPayload,
      intent,
    } = params;

    const validation =
      await validateFinalizePayment({
        client,
        paymentIntentId,
        txid,
        verifiedAmount,
        receiverWallet,
        rpcPayload,
        intent,
      });

    const {
      shipping,
      pricing,
      expectedAmount,
    } = validation;

    if (intent.status === "paid") {
      const existedOrder =
        await client.query<{
          id: string;
        }>(
          `
          SELECT id
          FROM orders
          WHERE pi_payment_id = $1
          LIMIT 1
          `,
          [piPaymentId]
        );

      return {
        ok: true,
        already: true,
        orderId:
          existedOrder.rows[0]?.id ??
          null,
        buyerId:
          intent.buyer_id,
        sellerId:
          intent.seller_id,
        amount:
          verifiedAmount,
      };
    }

    if (
      intent.status !== "verifying" &&
      intent.status !== "submitted" &&
      intent.status !== "wallet_opened"
    ) {
      throw new Error(
        "INVALID_PAYMENT_STATUS"
      );
    }

    const existingOrder =
      await client.query<{
        id: string;
      }>(
        `
        SELECT id
        FROM orders
        WHERE pi_payment_id = $1
        LIMIT 1
        `,
        [piPaymentId]
      );

    if (existingOrder.rows.length > 0) {
      return {
        ok: true,
        already: true,
        orderId:
          existingOrder.rows[0].id,
        buyerId:
          intent.buyer_id,
        sellerId:
          intent.seller_id,
        amount:
          verifiedAmount,
      };
    }

    await writePaymentAudit({
      paymentIntentId,
      eventCode:
        "ORDER_FINALIZE_STARTED",
      stage: "FINALIZE",
      actorType: "system",
      piPaymentId,
      txid,
      source: "orders.payment",
      newSettlementState:
        "FINALIZING_ORDER",
      payload: {
        verifiedAmount,
        receiverWallet,
      },
    });

    const createdOrder =
      await createOrder({
        userId:
          intent.buyer_id,

        piPaymentId,
        txid,

        idempotencyKey:
          paymentIntentId,

        country:
          intent.country,

        zone:
          intent.zone,

        shipping,

        pricing,

        items: [
          {
            product_id:
              intent.product_id,

            variant_id:
              intent.variant_id,

            quantity:
              intent.quantity,
          },
        ],
      });

    const orderId =
      createdOrder.orderId;

    if (!orderId) {
      throw new Error(
        "ORDER_CREATE_FAILED"
      );
    }

    await writePaymentAudit({
      paymentIntentId,
      eventCode:
        "ORDER_CREATED",
      stage: "FINALIZE",
      actorType: "system",
      piPaymentId,
      txid,
      source: "orders.payment",
      orderId,
      newSettlementState:
        "ORDER_CREATED",
    });

    await upsertPaymentReceipt(
  client,
  {
    paymentIntentId,
    buyerId: intent.buyer_id,
    orderId,
    piPaymentId,
    txid,
    expectedAmount,
    verifiedAmount,
    receiverWallet,
    piPayload,
    rpcPayload,
  }
);

    await upsertPiPayment(
  client,
  {
    paymentIntentId,
    orderId,
    buyerId: intent.buyer_id,
    country: intent.country,
    zone: intent.zone,
    piPaymentId,
    txid,
    expectedAmount,
    verifiedAmount,
    receiverWallet,
    piPayload,
    rpcPayload,
  }
);

    console.log(
  "[PAYMENT][FINALIZE_INTENT_CALL]"
);

await finalizePaymentIntent(
  client,
  {
    paymentIntentId,
    piPaymentId,
    txid,
  }
);

console.log(
  "[PAYMENT][FINALIZE_INTENT_DONE]"
);

    return {
      ok: true,
      already: false,
      orderId,
      buyerId:
        intent.buyer_id,
      sellerId:
        intent.seller_id,
      amount:
        verifiedAmount,
    };
  });
}
export async function linkReceiptSettlementByIds(input: {
  paymentIntentId: string;
  escrowId: string;
  sellerCreditId: string;
}): Promise<void> {
  return withTransaction(async (client) => {
    console.log(
      "[PAYMENT][RECEIPT_LINK] START",
      input
    );

    await linkReceiptSettlement(
      client,
      input
    );

    console.log(
      "[PAYMENT][RECEIPT_LINK] DONE",
      input
    );
  });
}

import { withTransaction } from "@/lib/db";

type MarkPaymentVerifyingInput = {
  paymentIntentId: string;
  userId: string;
  piPaymentId: string;
};

type PaymentIntentRow = {
  id: string;
  buyer_id: string;
  status: string;
};

export async function markPaymentVerifying({
  paymentIntentId,
  userId,
  piPaymentId,
}: MarkPaymentVerifyingInput) {
  return await withTransaction(async (client) => {
    const found = await client.query<PaymentIntentRow>(
      `
      SELECT id, buyer_id, status
      FROM payment_intents
      WHERE id = $1
      FOR UPDATE
      `,
      [paymentIntentId]
    );

    if (!found.rows.length) {
      throw new Error("INTENT_NOT_FOUND");
    }

    const intent = found.rows[0];

    if (intent.buyer_id !== userId) {
      throw new Error("FORBIDDEN");
    }

    /* =========================
       IDEMPOTENT
    ========================= */

    if (intent.status === "paid") {
      return {
        ok: true,
        already: true,
        status: "paid",
        paymentIntentId,
      };
    }

    if (intent.status === "verifying") {
      return {
        ok: true,
        already: true,
        status: "verifying",
        paymentIntentId,
      };
    }

    /* =========================
       STATUS GUARD
    ========================= */

    if (
      intent.status !== "created" &&
      intent.status !== "wallet_opened"
    ) {
      throw new Error("INVALID_STATUS");
    }

    /* =========================
       UPDATE LOCK STATE
    ========================= */

    await client.query(
      `
      UPDATE payment_intents
      SET
        status = 'verifying',
        pi_payment_id = $2,
        updated_at = now()
      WHERE id = $1
      `,
      [paymentIntentId, piPaymentId]
    );

    return {
      ok: true,
      status: "verifying",
      paymentIntentId,
    };
  });
}

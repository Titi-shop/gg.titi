import { query } from "@/lib/db";

export async function markPaymentVerifying({
  paymentIntentId,
  userId,
  piPaymentId,
}: {
  paymentIntentId: string;
  userId: string;
  piPaymentId: string;
}) {
  return await withTransaction(async (client) => {
    const { rows } = await client.query(
      `
      SELECT id, buyer_id, status
      FROM payment_intents
      WHERE id = $1
      FOR UPDATE
      `,
      [paymentIntentId]
    );

    if (!rows.length) {
      throw new Error("NOT_FOUND");
    }

    const intent = rows[0];

    if (intent.buyer_id !== userId) {
      throw new Error("FORBIDDEN");
    }

    if (intent.status === "paid") {
      return { ok: true, already: true };
    }

    if (
      intent.status !== "created" &&
      intent.status !== "wallet_opened"
    ) {
      throw new Error("INVALID_STATUS");
    }

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

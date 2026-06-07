import { query } from "@/lib/db/index";

type EnqueueParams = {
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
};

export async function enqueueReconcileJob({
  paymentIntentId,
  piPaymentId,
  txid,
}: EnqueueParams) {
  console.log("[PAYMENT_JOBS] ENQUEUE_START", {
    paymentIntentId,
    piPaymentId,
    txid,
  });

  const sql = `
    INSERT INTO payment_jobs (
      payment_intent_id,
      pi_payment_id,
      txid,
      status,
      run_after
    )
    VALUES ($1, $2, $3, 'pending', now())
    RETURNING id
  `;

  const result = await query(sql, [
    paymentIntentId,
    piPaymentId,
    txid,
  ]);

  const jobId = result.rows?.[0]?.id;

  console.log("[PAYMENT_JOBS] ENQUEUED", {
    jobId,
  });

  return {
    jobId,
    success: true,
  };
}


import { withTransaction } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

type BindParams = {
  userId: string;

  paymentIntentId: string;

  piPaymentId: string;

  piUid: string;

  verifiedAmount: number;

  piPayload: unknown;
};

type IntentRow = {
  id: string;

  buyer_id: string;

  status: string | null;

  pi_payment_id: string | null;
};

/* =========================================================
   HELPERS
========================================================= */

function vlog(
  step: string,
  data?: unknown
) {
  console.log(
    `[PAYMENTS_BIND_V7][${step}]`,
    data ?? ""
  );
}

function isUUID(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function safeAmount(
  value: unknown
): number {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    throw new Error(
      "INVALID_AMOUNT"
    );
  }

  return n;
}

/* =========================================================
   MAIN
========================================================= */

export async function bindPiPaymentToIntent(
  params: BindParams
): Promise<void> {
  return withTransaction(
    async (client) => {
      const {
        userId,
        paymentIntentId,
        piPaymentId,
        piUid,
        verifiedAmount,
        piPayload,
      } = params;

      vlog("START", {
        paymentIntentId,
        piPaymentId,
        userId,
      });

      /* ===============================================
         VALIDATION
      =============================================== */

      if (
        !isUUID(
          paymentIntentId
        )
      ) {
        throw new Error(
          "INVALID_PAYMENT_INTENT_ID"
        );
      }

      if (
        !isUUID(userId)
      ) {
        throw new Error(
          "INVALID_USER_ID"
        );
      }

      if (!piPaymentId) {
        throw new Error(
          "INVALID_PI_PAYMENT_ID"
        );
      }

      if (!piUid) {
        throw new Error(
          "INVALID_PI_UID"
        );
      }

      const amount =
        safeAmount(
          verifiedAmount
        );

      vlog("VALIDATION_OK", {
        amount,
      });

      /* ===============================================
         LOCK INTENT
      =============================================== */

      vlog("LOCK_START");

      const res =
        await client.query<IntentRow>(
          `
          SELECT
            id,
            buyer_id,
            status,
            pi_payment_id
          FROM payment_intents
          WHERE id = $1
          FOR UPDATE
          `,
          [paymentIntentId]
        );

      if (!res.rows.length) {
        throw new Error(
          "PAYMENT_INTENT_NOT_FOUND"
        );
      }

      const intent =
        res.rows[0];

      vlog("LOCK_OK", intent);

      /* ===============================================
         OWNER CHECK
      =============================================== */

      if (
        intent.buyer_id !==
        userId
      ) {
        throw new Error(
          "FORBIDDEN"
        );
      }

      /* ===============================================
         PAID IDEMPOTENT
      =============================================== */

      if (
        intent.status ===
        "paid"
      ) {
        vlog(
          "ALREADY_PAID_SKIP"
        );

        return;
      }

      /* ===============================================
         SAME PAYMENT REPLAY
      =============================================== */

      if (
        intent.pi_payment_id ===
        piPaymentId
      ) {
        vlog(
          "SAME_PAYMENT_REPLAY"
        );

        return;
      }

      /* ===============================================
         CONFLICT
      =============================================== */

      if (
        intent.pi_payment_id &&
        intent.pi_payment_id !==
          piPaymentId
      ) {
        throw new Error(
          "PI_PAYMENT_ALREADY_BOUND"
        );
      }

      /* ===============================================
         UPDATE
      =============================================== */

      vlog("UPDATE_START");

      await client.query(
        `
        UPDATE payment_intents
        SET
          pi_payment_id = $2,
          pi_user_uid = $3,
          pi_verified_amount = $4,
          pi_payment_payload = $5,

          status = 'submitted',

          updated_at = now()

        WHERE id = $1
        `,
        [
          paymentIntentId,
          piPaymentId,
          piUid,
          amount,
          JSON.stringify(
            piPayload ?? {}
          ),
        ]
      );

      vlog("UPDATE_OK", {
        paymentIntentId,
        piPaymentId,
      });

      vlog("SUCCESS");
    }
  );
}

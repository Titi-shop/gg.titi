import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

/* =========================
   TYPES
========================= */

type Body = {
  payment_intent_id?: unknown;
  pi_payment_id?: unknown;
};

/* =========================
   HELPERS
========================= */

function isUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function safeString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/* =========================
   API
========================= */

export async function POST(req: Request) {
  try {
    console.log("🟡 [PI_SUBMIT] START");

    /* ================= AUTH ================= */

    const auth = await getUserFromBearer();

    if (!auth) {
      console.error("❌ [PI_SUBMIT] UNAUTHORIZED");
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;

    /* ================= BODY ================= */

    const raw = await req.json().catch(() => null);

    if (!raw || typeof raw !== "object") {
      console.error("❌ [PI_SUBMIT] INVALID_BODY");
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const body = raw as Body;

    const paymentIntentId = body.payment_intent_id;
    const piPaymentId = safeString(body.pi_payment_id);

    if (!isUUID(paymentIntentId)) {
      console.error("❌ [PI_SUBMIT] INVALID_PAYMENT_INTENT", paymentIntentId);
      return NextResponse.json({ error: "INVALID_PAYMENT_INTENT" }, { status: 400 });
    }

    if (!piPaymentId) {
      console.error("❌ [PI_SUBMIT] MISSING_PI_PAYMENT_ID");
      return NextResponse.json({ error: "MISSING_PI_PAYMENT_ID" }, { status: 400 });
    }

    console.log("🟡 [PI_SUBMIT] INPUT_OK", {
      userId,
      paymentIntentId,
      piPaymentId,
    });

    /* ================= LOCK + VALIDATE ================= */

    const intent = await withTransaction(async (client) => {
      const res = await client.query(
        `
        SELECT *
        FROM payment_intents
        WHERE id = $1
          AND buyer_id = $2
        FOR UPDATE
        `,
        [paymentIntentId, userId]
      );

      if (!res.rows.length) {
        throw new Error("INTENT_NOT_FOUND");
      }

      const row = res.rows[0];

      /* ===== already submitted / paid idempotent ===== */

      if (
        row.status === "submitted" ||
        row.status === "verifying" ||
        row.status === "paid"
      ) {
        console.log("🟢 [PI_SUBMIT] IDEMPOTENT_SKIP", {
          intentId: row.id,
          status: row.status,
        });

        return row;
      }

      if (row.status !== "pending") {
        throw new Error("INTENT_INVALID_STATE");
      }

      /* ===== bind pi payment id ===== */

      await client.query(
        `
        UPDATE payment_intents
        SET pi_payment_id = $2
        WHERE id = $1
        `,
        [row.id, piPaymentId]
      );

      /* ===== create/update pi_payments ===== */

      await client.query(
        `
        INSERT INTO pi_payments (
          payment_intent_id,
          pi_payment_id,
          status
        )
        VALUES ($1,$2,'approving')
        ON CONFLICT (pi_payment_id)
        DO UPDATE SET
          payment_intent_id = EXCLUDED.payment_intent_id,
          status = 'approving'
        `,
        [row.id, piPaymentId]
      );

      return {
        ...row,
        pi_payment_id: piPaymentId,
      };
    });

    /* ================= CALL PI APPROVE ================= */

    console.log("🟡 [PI_SUBMIT] CALL_PI_APPROVE", piPaymentId);

    const approveRes = await fetch(
      `${PI_API}/payments/${piPaymentId}/approve`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_KEY}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    const approveText = await approveRes.text();

    console.log("🟡 [PI_SUBMIT] PI_APPROVE_STATUS", approveRes.status);

    if (!approveRes.ok) {
      console.error("❌ [PI_SUBMIT] PI_APPROVE_FAILED", approveText);

      await withTransaction(async (client) => {
        await client.query(
          `
          UPDATE payment_intents
          SET status = 'failed',
              failed_reason = 'pi_approve_failed'
          WHERE id = $1
          `,
          [intent.id]
        );

        await client.query(
          `
          UPDATE pi_payments
          SET status = 'failed'
          WHERE pi_payment_id = $1
          `,
          [piPaymentId]
        );
      });

      return NextResponse.json(
        { error: "PI_APPROVE_FAILED" },
        { status: 400 }
      );
    }

    /* ================= MARK SUBMITTED ================= */

    await withTransaction(async (client) => {
      await client.query(
        `
        UPDATE payment_intents
        SET status = 'submitted',
            submitted_at = now()
        WHERE id = $1
        `,
        [intent.id]
      );

      await client.query(
        `
        UPDATE pi_payments
        SET status = 'approved',
            approved_at = now()
        WHERE pi_payment_id = $1
        `,
        [piPaymentId]
      );
    });

    console.log("🟢 [PI_SUBMIT] SUCCESS", {
      paymentIntentId: intent.id,
      piPaymentId,
    });

    return NextResponse.json({
      ok: true,
      paymentIntentId: intent.id,
      piPaymentId,
    });
  } catch (err) {
    const code =
      err instanceof Error && err.message
        ? err.message
        : "PI_SUBMIT_FAILED";

    console.error("🔥 [PI_SUBMIT] CRASH", code);

    return NextResponse.json(
      { error: code },
      { status: 400 }
    );
  }
}

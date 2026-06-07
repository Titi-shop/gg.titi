import { NextResponse } from "next/server";

import {
  runPaymentSettlement,
} from "@/lib/payments/payment.orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type PiWebhookBody = {
  paymentId?: string;
  payment_id?: string;
  pi_payment_id?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function extractPiPaymentId(raw: unknown): string | null {
  if (!isRecord(raw)) return null;

  const id =
    typeof raw.paymentId === "string"
      ? raw.paymentId
      : typeof raw.payment_id === "string"
        ? raw.payment_id
        : typeof raw.pi_payment_id === "string"
          ? raw.pi_payment_id
          : null;

  if (!id) return null;

  const clean = id.trim();
  return clean.length ? clean : null;
}

/* =========================================================
   WEBHOOK HANDLER
========================================================= */

export async function POST(req: Request) {
  console.log("[PI WEBHOOK] START");

  try {
    const raw = await req.json().catch(() => null);

    console.log("[PI WEBHOOK] BODY", raw);

    const piPaymentId = extractPiPaymentId(raw);

    if (!piPaymentId) {
      console.warn("[PI WEBHOOK] NO_PAYMENT_ID");

      return NextResponse.json(
        { ok: false, error: "NO_PAYMENT_ID" },
        { status: 400 }
      );
    }

    /* =====================================================
       STEP 1 — FETCH REAL PAYMENT FROM PI PLATFORM
    ===================================================== */

    console.log("[PI WEBHOOK] FETCH_PI_PAYMENT");

    const piPayment = await fetchPiPayment(piPaymentId);

    if (!piPayment) {
      console.warn("[PI WEBHOOK] PI_PAYMENT_NOT_FOUND");

      return NextResponse.json(
        { ok: false, error: "PI_PAYMENT_NOT_FOUND" },
        { status: 400 }
      );
    }

    console.log("[PI WEBHOOK] PI_PAYMENT_OK", {
      piPaymentId,
    });

    const paymentIntentId =
      typeof piPayment.metadata?.payment_intent_id === "string"
        ? piPayment.metadata.payment_intent_id.trim()
        : "";

    const txid =
      typeof piPayment.transaction?.txid === "string"
        ? piPayment.transaction.txid.trim()
        : "";

    if (!paymentIntentId || !txid) {
      console.warn("[PI WEBHOOK] PAYMENT_NOT_READY", {
        paymentIntentId,
        txid,
      });

      return NextResponse.json({
        success: true,
        waiting: true,
      });
    }

    /* =====================================================
       STEP 2 — RUN SAME CORE SETTLEMENT ENGINE
    ===================================================== */

    console.log("[PI WEBHOOK] RUN_SETTLEMENT");

    const result = await runPaymentSettlement({
      paymentIntentId,
      piPaymentId,
      txid,
      userId: null,
      source: "webhook",
    });

    console.log("[PI WEBHOOK] SETTLEMENT_DONE", {
      ok: result.ok,
      orderId: result.orderId,
      alreadyPaid: result.alreadyPaid,
    });

    return NextResponse.json({
      success: true,
      order_id: result.orderId,
      already_paid: result.alreadyPaid,
    });
  } catch (err) {
    console.error("[PI WEBHOOK] CRASH", err);

    return NextResponse.json(
      { error: "WEBHOOK_FAILED" },
      { status: 500 }
    );
  }
}


"use client";

import { useCallback } from "react";
import { getPiAccessToken } from "@/lib/piAuth";
import type { ShippingInfo, Region } from "./checkout.types";

/* =========================
   TYPES
========================= */

type Item = {
  id: string;
  name: string;
  thumbnail?: string;
  stock: number;
};

type PreviewPayload = {
  shipping: ShippingInfo;
  zone: Region;
  item: Item;
  quantity: number;
  variant_id?: string | null;
};

type PaymentIntentResponse = {
  paymentIntentId: string;
  amount: number;
  merchantWallet: string;
  memo: string;
  nonce: string;
};

type ValidateParams = {
  user: unknown;
  piReady: boolean;
  shipping: ShippingInfo | null;
  zone: Region | null;
  item: Item | null;
  quantity: number;
  maxStock: number;
  pilogin?: () => void;
  showMessage: (text: string) => void;
  t: Record<string, string>;
};

type UseCheckoutPayParams = {
  item: Item | null;
  quantity: number;
  total: number;
  shipping: ShippingInfo | null;
  unitPrice: number;
  processing: boolean;
  setProcessing: (v: boolean) => void;
  processingRef: { current: boolean };
  t: Record<string, string>;
  user: unknown;
  router: { replace: (path: string) => void };
  onClose: () => void;
  zone: Region | null;
  product: { variant_id?: string | null };
  showMessage: (text: string, type?: "error" | "success") => void;
  validate: () => boolean;
  preview: { total: number } | null;
};

/* =========================
   PREVIEW DIRECT (UI ONLY)
========================= */

async function previewOrderDirect({
  shipping,
  zone,
  item,
  quantity,
  variant_id,
}: PreviewPayload) {
  const token = await getPiAccessToken();

  const res = await fetch("/api/orders/preview", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      country: shipping.country.toUpperCase(),
      zone,
      shipping: {
        region: shipping.region,
        district: shipping.district,
        ward: shipping.ward,
      },
      items: [
        {
          product_id: item.id,
          variant_id: variant_id ?? null,
          quantity,
        },
      ],
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "PREVIEW_FAILED");
  }

  return data as { total: number };
}

/* =========================
   CREATE PAYMENT INTENT
========================= */

async function createPiPaymentIntent(params: {
  item: Item;
  quantity: number;
  shipping: ShippingInfo;
  zone: Region;
  variantId?: string | null;
}) {
  const token = await getPiAccessToken();

  const res = await fetch("/api/payments/pi/create-intent", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_id: params.item.id,
      variant_id: params.variantId ?? null,
      quantity: params.quantity,
      country: params.shipping.country.toUpperCase(),
      shipping: {
        name: params.shipping.name,
        phone: params.shipping.phone,
        address_line: params.shipping.address_line,
        ward: params.shipping.ward,
        district: params.shipping.district,
        region: params.shipping.region,
        postal_code: params.shipping.postal_code,
      },
      zone: params.zone,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "CREATE_INTENT_FAILED");
  }

  return data as PaymentIntentResponse;
}

/* =========================
   SUBMIT PAYMENT
========================= */

async function submitPiPayment(params: {
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
}) {
  const token = await getPiAccessToken();

  const res = await fetch("/api/payments/pi/submit", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "SUBMIT_FAILED");
  }

  return data as { success: true; orderId: string };
}

/* =========================
   ERROR MAP
========================= */

export const getErrorKey = (code?: string) => {
  const map: Record<string, string> = {
    UNSUPPORTED_COUNTRY: "unsupported_country",
    PREVIEW_FAILED: "order_preview_failed",
    INVALID_REGION: "invalid_region",
    SHIPPING_NOT_AVAILABLE: "shipping_not_available",
    OUT_OF_STOCK: "error_out_of_stock",
    INVALID_QUANTITY: "error_invalid_quantity",
    CREATE_INTENT_FAILED: "payment_intent_failed",
    SUBMIT_FAILED: "payment_submit_failed",
  };

  return map[code || ""] || "unknown_error";
};

/* =========================
   VALIDATE
========================= */

export function validateBeforePay({
  user,
  piReady,
  shipping,
  zone,
  item,
  quantity,
  maxStock,
  pilogin,
  showMessage,
  t,
}: ValidateParams): boolean {
  if (!user) {
    localStorage.setItem("pending_checkout", "1");
    pilogin?.();
    showMessage(t.please_login ?? "please_login");
    return false;
  }

  if (!piReady) {
    showMessage(t.pi_not_ready ?? "pi_not_ready");
    return false;
  }

  if (!shipping) {
    showMessage(t.please_add_shipping_address ?? "no_address");
    return false;
  }

  if (!shipping.country || !shipping.region) {
    showMessage(t.invalid_shipping_country ?? "invalid_country");
    return false;
  }

  if (!zone) {
    showMessage(t.shipping_required ?? "select_region");
    return false;
  }

  if (!item?.id) {
    showMessage(t.invalid_product ?? "invalid_product");
    return false;
  }

  if (quantity < 1 || quantity > maxStock) {
    showMessage(t.invalid_quantity ?? "invalid_quantity");
    return false;
  }

  if (item.stock <= 0) {
    showMessage(t.out_of_stock ?? "out_of_stock");
    return false;
  }

  return true;
}

/* =========================
   PAY FINAL
========================= */

export function useCheckoutPay({
  item,
  quantity,
  processing,
  setProcessing,
  processingRef,
  t,
  user,
  router,
  onClose,
  zone,
  product,
  showMessage,
  validate,
  preview,
  shipping,
}: UseCheckoutPayParams) {
  return useCallback(async () => {
    if (processingRef.current || processing) return;
    if (!validate()) return;

    processingRef.current = true;
    setProcessing(true);

    try {
      if (!preview && shipping && zone && item) {
        await previewOrderDirect({
          shipping,
          zone,
          item,
          quantity,
          variant_id: product.variant_id ?? null,
        });
      }

      if (!shipping || !zone || !item) {
        throw new Error("INVALID_CHECKOUT_DATA");
      }

      const intent = await createPiPaymentIntent({
        item,
        quantity,
        shipping,
        zone,
        variantId: product.variant_id ?? null,
      });

      if (!window.Pi) {
  throw new Error("PI_SDK_NOT_LOADED");
}

await window.Pi.createPayment(
  {
    amount: Number(intent.amount),
    memo: String(intent.memo),
    metadata: {
      payment_intent_id: String(intent.paymentIntentId),
      nonce: String(intent.nonce),
    },
  },
  {
    onReadyForServerApproval: async (_paymentId, callback) => {
      callback();
    },

    onReadyForServerCompletion: async (piPaymentId, txid) => {
      try {
        await submitPiPayment({
          paymentIntentId: intent.paymentIntentId,
          piPaymentId,
          txid,
        });

        onClose();
        router.replace("/customer/orders?tab=pending");
        showMessage(t.payment_success ?? "success", "success");
      } catch (err) {
        console.error("SUBMIT ERROR:", err);
        showMessage(t.payment_failed ?? "payment_failed");
      } finally {
        processingRef.current = false;
        setProcessing(false);
      }
    },

    onCancel: () => {
      processingRef.current = false;
      setProcessing(false);
    },

    onError: () => {
      processingRef.current = false;
      setProcessing(false);
    },
  }
);
    } catch (err) {
      processingRef.current = false;
      setProcessing(false);

      const key = getErrorKey((err as Error).message);
      showMessage(t[key] ?? key);
    }
  }, [
    item,
    quantity,
    processing,
    setProcessing,
    processingRef,
    t,
    user,
    router,
    onClose,
    zone,
    product.variant_id,
    preview,
    validate,
    showMessage,
    shipping,
  ]);
}
2) app/api/payments/pi/create-intent/route.ts

import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { createPiPaymentIntent } from "@/lib/db/payments.intent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================
   TYPES
========================= */

type Body = {
  product_id?: unknown;
  variant_id?: unknown;
  quantity?: unknown;
  country?: unknown;
  zone?: unknown;
  shipping?: unknown;
};

type ShippingInput = {
  name: string;
  phone: string;
  address_line: string;
  ward?: string | null;
  district?: string | null;
  region?: string | null;
  postal_code?: string | null;
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

function safeQty(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return 1;
  if (n > 10) return 10;
  return n;
}

function normalizeShipping(v: unknown): ShippingInput | null {
  if (!v || typeof v !== "object") return null;

  const raw = v as Record<string, unknown>;

  const name =
    typeof raw.name === "string" ? raw.name.trim() : "";

  const phone =
    typeof raw.phone === "string" ? raw.phone.trim() : "";

  const address_line =
    typeof raw.address_line === "string" ? raw.address_line.trim() : "";

  if (!name || !phone || !address_line) return null;

  return {
    name,
    phone,
    address_line,
    ward: typeof raw.ward === "string" ? raw.ward.trim() : null,
    district: typeof raw.district === "string" ? raw.district.trim() : null,
    region: typeof raw.region === "string" ? raw.region.trim() : null,
    postal_code: typeof raw.postal_code === "string" ? raw.postal_code.trim() : null,
  };
}

/* =========================
   API
========================= */

export async function POST(req: Request) {
  try {
    console.log("🟡 [PAYMENT_INTENT] START");

    /* ================= AUTH ================= */

    const auth = await getUserFromBearer();

    if (!auth) {
      console.error("❌ [PAYMENT_INTENT] UNAUTHORIZED");
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    /* ================= BODY ================= */

    const raw = await req.json().catch(() => null);

    if (!raw || typeof raw !== "object") {
      console.error("❌ [PAYMENT_INTENT] INVALID_BODY");
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const body = raw as Body;

    const productId = body.product_id;
    const variantId = body.variant_id;
    const quantity = safeQty(body.quantity);

    const country =
      typeof body.country === "string"
        ? body.country.trim().toUpperCase()
        : "";

    const zone =
      typeof body.zone === "string"
        ? body.zone.trim().toLowerCase()
        : "";

    const shipping = normalizeShipping(body.shipping);

    if (!isUUID(productId)) {
      console.error("❌ [PAYMENT_INTENT] INVALID_PRODUCT_ID", productId);
      return NextResponse.json(
        { error: "INVALID_PRODUCT_ID" },
        { status: 400 }
      );
    }

    if (variantId !== null && variantId !== undefined && !isUUID(variantId)) {
      console.error("❌ [PAYMENT_INTENT] INVALID_VARIANT_ID", variantId);
      return NextResponse.json(
        { error: "INVALID_VARIANT_ID" },
        { status: 400 }
      );
    }

    if (!country) {
      return NextResponse.json(
        { error: "INVALID_COUNTRY" },
        { status: 400 }
      );
    }

    if (!zone) {
      return NextResponse.json(
        { error: "INVALID_ZONE" },
        { status: 400 }
      );
    }

    if (!shipping) {
      return NextResponse.json(
        { error: "INVALID_SHIPPING" },
        { status: 400 }
      );
    }

    console.log("🟡 [PAYMENT_INTENT] CALL_DB", {
      productId,
      variantId,
      quantity,
      country,
      zone,
      userId,
    });

    /* ================= DB LAYER ================= */

    const intent = await createPiPaymentIntent({
      userId,
      productId,
      variantId: variantId ?? null,
      quantity,
      country,
      zone,
      shipping,
    });

    console.log("🟢 [PAYMENT_INTENT] SUCCESS", {
      paymentIntentId: intent.paymentIntentId,
    });

    return NextResponse.json(intent);
  } catch (err) {
    const code =
      err instanceof Error && err.message
        ? err.message
        : "CREATE_INTENT_FAILED";

    console.error("🔥 [PAYMENT_INTENT] CRASH", code);

    return NextResponse.json(
      { error: code },
      { status: 400 }
    );
  }
}
3) app/api/payments/pi/submit/route.ts

import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { withTransaction, query } from "@/lib/db";

export const runtime = "nodejs";

/* =========================
   TYPES
========================= */

type SubmitBody = {
  payment_intent_id: string;
  txid: string;
  pi_payment_id: string;
};

/* =========================
   HELPERS
========================= */

function isUUID(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f-]{36}$/i.test(v);
}

/* =========================
   MOCK VERIFY (replace later)
========================= */

async function verifyPi(pi_payment_id: string) {
  return {
    ok: true,
    amount: 10,
    raw: {}
  };
}

async function verifyRpc(txid: string) {
  return {
    ok: true,
    receiver: process.env.PI_MERCHANT_WALLET as string,
    amount: 10,
    raw: {}
  };
}

/* =========================
   API
========================= */

export async function POST(req: Request) {
  try {
    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;

    const body = (await req.json()) as SubmitBody;

    if (!isUUID(body.payment_intent_id)) {
      return NextResponse.json({ error: "INVALID_INTENT" }, { status: 400 });
    }

    console.log("[PAYMENT][SUBMIT] START", { userId });

    const result = await withTransaction(async (client) => {

      /* =========================
         LOCK INTENT
      ========================= */

      const intentRes = await client.query(
        `
        SELECT *
        FROM payment_intents
        WHERE id = $1 AND buyer_id = $2
        FOR UPDATE
        `,
        [body.payment_intent_id, userId]
      );

      if (!intentRes.rows.length) {
        throw new Error("NOT_FOUND");
      }

      const intent = intentRes.rows[0];

      /* =========================
         IDEMPOTENCY CHECK
      ========================= */

      if (intent.status === "paid") {
        return { ok: true, already: true };
      }

      /* =========================
         VERIFY PI
      ========================= */

      const pi = await verifyPi(body.pi_payment_id);

      if (!pi.ok) {
        throw new Error("PI_FAILED");
      }

      /* =========================
         VERIFY RPC
      ========================= */

      const rpc = await verifyRpc(body.txid);

      if (!rpc.ok) {
        throw new Error("RPC_FAILED");
      }

      /* =========================
         VERIFY AMOUNT
      ========================= */

      if (Number(pi.amount) !== Number(intent.total_amount)) {
        throw new Error("AMOUNT_MISMATCH");
      }

      /* =========================
         INSERT RPC LOG
      ========================= */

      await client.query(
        `
        INSERT INTO rpc_verification_logs (
          payment_intent_id,
          txid,
          verified,
          reason,
          payload
        )
        VALUES ($1,$2,$3,$4,$5)
        `,
        [
          intent.id,
          body.txid,
          true,
          null,
          JSON.stringify(rpc.raw)
        ]
      );

      /* =========================
         UPDATE PI PAYMENTS
      ========================= */

      await client.query(
        `
        UPDATE pi_payments
        SET status = 'verified',
            txid = $2
        WHERE pi_payment_id = $1
        `,
        [body.pi_payment_id, body.txid]
      );

      /* =========================
         UPDATE INTENT
      ========================= */

      await client.query(
        `
        UPDATE payment_intents
        SET status = 'paid',
            txid = $2,
            pi_payment_id = $3,
            paid_at = now()
        WHERE id = $1
        `,
        [intent.id, body.txid, body.pi_payment_id]
      );

      /* =========================
         CREATE ORDER (atomic)
      ========================= */

      const order = await client.query(
        `
        INSERT INTO orders (
          buyer_id,
          seller_id,
          total_amount,
          status
        )
        VALUES ($1,$2,$3,'paid')
        RETURNING id
        `,
        [
          intent.buyer_id,
          intent.seller_id,
          intent.total_amount
        ]
      );

      return {
        ok: true,
        order_id: order.rows[0].id
      };
    });

    return NextResponse.json(result);

  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "SUBMIT_FAILED" },
      { status: 400 }
    );
  }
}

import { createPiPaymentIntent } from "@/lib/db/payments.intent";
import { getAddressById } from "@/lib/db/addresses";
import {
  calculatePricing,
  type PricingInput,
  type PricingResult,
} from "@/lib/payments/pricing.engine";
import type {
  RawInput,
  CreateIntentNormalizedInput,
  CreateIntentServiceResult,
  ShippingInput,
} from "@/lib/payments/types";
/* =========================================================
   HELPERS
========================================================= */

function vlog(
  step: string,
  data?: unknown
) {
  console.log(
    `[PAYMENT_INTENT_SERVICE_V7][${step}]`,
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

function safeQty(
  value: unknown
): number {
  const n = Number(value);

  if (
    !Number.isInteger(n) ||
    n <= 0
  ) {
    return 1;
  }

  return Math.min(n, 10);
}

function normalizeShipping(
  raw: ShippingInput
): ShippingInput {
  return {
    name:
      typeof raw.name ===
      "string"
        ? raw.name.trim()
        : "",

    phone:
      typeof raw.phone ===
      "string"
        ? raw.phone.trim()
        : "",

    address_line:
      typeof raw.address_line ===
      "string"
        ? raw.address_line.trim()
        : "",

    ward:
      typeof raw.ward ===
      "string"
        ? raw.ward.trim()
        : null,

    district:
      typeof raw.district ===
      "string"
        ? raw.district.trim()
        : null,

    region:
      typeof raw.region ===
      "string"
        ? raw.region.trim()
        : null,

    postal_code:
      typeof raw.postal_code ===
      "string"
        ? raw.postal_code.trim()
        : null,
  };
}

function normalizeCreateIntentInput({
  userId,
  raw,
}: RawInput): NormalizedIntentInput {
  if (
    !raw ||
    typeof raw !== "object"
  ) {
    throw new Error(
      "INVALID_BODY"
    );
  }

  const body =
    raw as Record<
      string,
      unknown
    >;

  const productId =
    typeof body.product_id ===
    "string"
      ? body.product_id.trim()
      : "";

  const variantId =
    typeof body.variant_id ===
      "string" &&
    body.variant_id.trim()
      ? body.variant_id.trim()
      : null;

  const quantity =
    safeQty(body.quantity);
  
const addressId =
  typeof body.address_id === "string"
    ? body.address_id.trim()
    : "";

if (!isUUID(addressId)) {
  throw new Error("INVALID_ADDRESS_ID");
}
return {
  userId,
  addressId,
  productId,
  variantId,
  quantity,
};
}

function buildPricingInput(
  input: NormalizedIntentInput
): PricingInput {
  return {
    user_id: input.userId,
    address_id: input.addressId,
    items: [
      {
        product_id: input.productId,
        variant_id: input.variantId,
        quantity: input.quantity,
      },
    ],
  };
}

function extractPaymentIntentId(
  value: unknown
): string {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return "";
  }

  const row =
    value as Record<
      string,
      unknown
    >;

  const result =
    row.payment_intent_id ??
    row.paymentIntentId ??
    row.id;

  return typeof result ===
    "string"
    ? result
    : "";
}

/* =========================================================
   MAIN
========================================================= */

export async function createPiIntentFromRequest({
  userId,
  raw,
}: RawInput): Promise<CreateIntentServiceResult> {
  vlog("START", {
    userId,
  });

  const normalized =
    normalizeCreateIntentInput(
      {
        userId,
        raw,
      }
    );
const address = await getAddressById(
  normalized.userId,
  normalized.addressId
);

if (!address) {
  throw new Error("ADDRESS_NOT_FOUND");
}

const shipping: ShippingInput = {
  name: String(address.full_name ?? ""),
  phone: String(address.phone ?? ""),
  address_line: String(address.address_line ?? ""),

  ward: address.ward ?? null,
  district: address.district ?? null,
  region: address.region ?? null,
  postal_code: address.postal_code ?? null,
};
  vlog(
    "NORMALIZED",
    normalized
  );

  /* =====================================================
     AUTHORITATIVE PRICING
  ===================================================== */

  const pricingInput =
    buildPricingInput(
      normalized
    );

  vlog(
    "PRICING_INPUT",
    pricingInput
  );

  const pricing: PricingResult =
    await calculatePricing(
      pricingInput
    );

  vlog(
    "PRICING_RESULT",
    pricing
  );

  /* =====================================================
     CREATE DB INTENT
  ===================================================== */

  const dbResult =
   
    await createPiPaymentIntent({
  userId: normalized.userId,
  productId: normalized.productId,
  variantId: normalized.variantId,
  quantity: normalized.quantity,
  shipping,
  pricing,
});
  vlog(
    "DB_RESULT",
    dbResult
  );

  const paymentIntentId =
    extractPaymentIntentId(
      dbResult
    );

  if (!paymentIntentId) {
    throw new Error(
      "CREATE_INTENT_RETURN_INVALID"
    );
  }

  const result: CreateIntentServiceResult =
    {
      payment_intent_id:
        paymentIntentId,

      pi_payment_id:
        typeof dbResult.pi_payment_id ===
        "string"
          ? dbResult.pi_payment_id
          : "",

      amount:
        Number(
          dbResult.amount
        ) || 0,

      memo:
        typeof dbResult.memo ===
        "string"
          ? dbResult.memo
          : "",

      metadata:
        typeof dbResult.metadata ===
          "object" &&
        dbResult.metadata !==
          null
          ? dbResult.metadata
          : {},

      to_address:
        typeof dbResult.merchant_wallet ===
        "string"
          ? dbResult.merchant_wallet
          : "",
    };

  vlog("SUCCESS", {
    paymentIntentId:
      result.payment_intent_id,

    amount:
      result.amount,
  });

  return result;
}



import {
  calculatePricing,
  type PricingInput,
  type PricingResult,
} from "@/lib/payments/pricing.engine";

/* =========================================================
   TYPES
========================================================= */

export type PreviewItemInput = {
  product_id: string;
  quantity: number;
  variant_id?: string | null;
};

export type PreviewOrderInput = {
  userId: string;
  address_id: string; 
  items: PreviewItemInput[];
};

export type PreviewOrderResult = {
  items: {
    product_id: string;
    variant_id: string | null;
    name: string;
    price: number;
    quantity: number;
    total: number;
  }[];

  subtotal: number;
  shipping_fee: number;
  total: number;

  buyer_zone: string;
  shipping_zone: string;
};
/* =========================================================
   LOGGER
========================================================= */

function vlog(
  step: string,
  data?: unknown
) {
  console.log(
    `[ORDER_PREVIEW_V7][${step}]`,
    data ?? ""
  );
}

/* =========================================================
   MAPPER
========================================================= */

function mapPricingToPreview(
  pricing: PricingResult
): PreviewOrderResult {
  return {
  items: pricing.items.map((item) => ({
    product_id: item.product_id,
    variant_id: item.variant_id,
    name: item.name,
    price: item.unit_price,
    quantity: item.quantity,
    total: item.subtotal,
  })),

  subtotal: pricing.subtotal,
  shipping_fee: pricing.shipping_fee,
  total: pricing.total,

  buyer_zone: pricing.buyer_zone,
  shipping_zone: pricing.shipping_zone,
};
}

/* =========================================================
   MAIN
========================================================= */

export async function previewOrder(
  input: PreviewOrderInput
) {
  vlog("START", input);

  if (!input.userId) {
    throw new Error("INVALID_USER");
  }

const pricingInput: PricingInput = {
  user_id: input.userId,
  address_id: input.address_id, 
  items: input.items.map((item) => ({
    product_id: item.product_id,
    variant_id: item.variant_id ?? null,
    quantity: item.quantity,
  })),
};

  vlog("PRICING_INPUT", pricingInput);

  const pricing =
    await calculatePricing(pricingInput);

  return mapPricingToPreview(pricing);
}

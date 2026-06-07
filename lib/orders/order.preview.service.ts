import { previewOrder } from "@/lib/db/orders.preview";

/* =========================================================
   TYPES
========================================================= */

type RawInput = {
  userId: string;
  raw: unknown;
};

type PreviewItem = {
  product_id: string;
  quantity: number;
  variant_id: string | null;
};

type PreviewNormalizedInput = {
  userId: string;
  address_id: string;
  items: PreviewItem[];
};

/* =========================================================
   HELPERS
========================================================= */

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function safeQty(v: unknown): number {
  const n = Number(v);

  if (!Number.isInteger(n) || n <= 0) {
    return 1;
  }

  return Math.min(n, 100);
}



  function normalizePreviewInput({
  userId,
  raw,
}: RawInput): PreviewNormalizedInput {
  if (!raw || typeof raw !== "object") {
    throw new Error("INVALID_BODY");
  }

  const body = raw as Record<string, unknown>;
     
if ("zone" in body) {
  console.warn(
    "[ORDER_PREVIEW] zone from client ignored",
    body.zone
  );
}
     
  const address_id =
    typeof body.address_id === "string"
      ? body.address_id.trim()
      : "";

  if (!isUUID(address_id)) {
    throw new Error("INVALID_ADDRESS_ID");
  }

  /* =========================
     FIX: EXTRACT ITEMS HERE
  ========================= */
  const rawItems = Array.isArray(body.items) ? body.items : [];

  if (!rawItems.length) {
    throw new Error("INVALID_ITEMS");
  }

  const items: PreviewItem[] = [];

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as Record<string, unknown>;

    const product_id =
      typeof item.product_id === "string"
        ? item.product_id.trim()
        : "";

    const variant_id =
      typeof item.variant_id === "string" && item.variant_id.trim()
        ? item.variant_id.trim()
        : null;

    const quantity = safeQty(item.quantity);

    if (!isUUID(product_id)) {
      continue;
    }

    if (variant_id && !isUUID(variant_id)) {
      continue;
    }

    items.push({
      product_id,
      variant_id,
      quantity,
    });
  }

  if (!items.length) {
    throw new Error("INVALID_ITEMS");
  }

  return {
    userId,
    address_id,
    items,
  };
  }

/* =========================================================
   MAIN SERVICE
========================================================= */

export async function previewOrderFromRequest(input: RawInput) {
  const normalized = normalizePreviewInput(input);

  console.log("[ORDER][PREVIEW][START]", {
  userId: normalized.userId,
  address_id: normalized.address_id,
  items: normalized.items,
});

  const result = await previewOrder(normalized);

  console.log("[ORDER][PREVIEW][SUCCESS]", {
  buyer_zone: result.buyer_zone,
  subtotal: result.subtotal,
  shipping: result.shipping_fee,
  total: result.total,
});
  return result;
}

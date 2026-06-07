import type {
  ProductVariant,
} from "@/types/product";

/* =========================================================
   RAW INPUT TYPE
========================================================= */

type VariantInput = {
  id?: unknown;

  /* OPTIONS */
  option1?: unknown;
  option2?: unknown;
  option3?: unknown;

  option_label1?: unknown;
  option_label2?: unknown;
  option_label3?: unknown;

  /* BASIC */
  name?: unknown;
  sku?: unknown;

  /* PRICE */
  price?: unknown;
  sale_price?: unknown;
  final_price?: unknown;

  currency?: unknown;

  /* SALE */
  sale_enabled?: unknown;
  sale_stock?: unknown;
  sale_sold?: unknown;

  /* STOCK */
  stock?: unknown;
  is_unlimited?: unknown;

  /* MEDIA */
  image?: unknown;

  /* STATUS */
  is_active?: unknown;

  sort_order?: unknown;

  /* ANALYTICS */
  sold?: unknown;
};

/* =========================================================
   HELPERS
========================================================= */

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function safeString(
  value: unknown,
  fallback = ""
): string {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim();
}

function safeNullableString(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed =
    value.trim();

  return trimmed.length > 0
    ? trimmed
    : null;
}

function safeNumber(
  value: unknown,
  fallback = 0
): number {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  const n =
    Number(value);

  return Number.isNaN(n)
    ? fallback
    : n;
}

function safeNullableNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const n =
    Number(value);

  return Number.isNaN(n)
    ? null
    : n;
}

function safeBoolean(
  value: unknown,
  fallback = false
): boolean {
  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  if (
    typeof value ===
    "string"
  ) {
    return value === "true";
  }

  if (
    typeof value ===
    "number"
  ) {
    return value === 1;
  }

  return fallback;
}

function buildVariantName(
  option1: string,
  option2?: string | null,
  option3?: string | null
): string {
  return [
    option1,
    option2,
    option3,
  ]
    .filter(
      (
        value
      ): value is string =>
        Boolean(
          value &&
            value.trim()
              .length > 0
        )
    )
    .join(" - ");
}

function calcFinalPrice(
  price: number,
  sale_price: number | null,
  sale_enabled: boolean
): number {
  if (
    sale_enabled &&
    sale_price !== null &&
    sale_price > 0 &&
    sale_price < price
  ) {
    return sale_price;
  }

  return price;
}

/* =========================================================
   NORMALIZE SINGLE VARIANT
========================================================= */

export function normalizeVariant(
  raw: unknown,
  index = 0
): ProductVariant | null {
  if (!isObject(raw)) {
    return null;
  }

  const item =
    raw as VariantInput;

  /* ================= OPTIONS ================= */

  const option1 =
    safeString(
      item.option1
    );

  if (!option1) {
    console.warn(
      "❌ INVALID_VARIANT_OPTION1",
      {
        index,
        raw,
      }
    );

    return null;
  }

  const option2 =
    safeNullableString(
      item.option2
    );

  const option3 =
    safeNullableString(
      item.option3
    );

  /* ================= PRICE ================= */

  const price =
    safeNumber(
      item.price
    );

  const sale_enabled =
    safeBoolean(
      item.sale_enabled
    );

  const sale_price =
    safeNullableNumber(
      item.sale_price
    );

  const final_price =
    calcFinalPrice(
      price,
      sale_price,
      sale_enabled
    );

  /* ================= STOCK ================= */

  const stock =
    safeNumber(
      item.stock
    );

  const sale_stock =
    safeNumber(
      item.sale_stock
    );

  /* ================= NORMALIZED ================= */

  const variant: ProductVariant =
    {
      id:
        safeNullableString(
          item.id
        ) ?? undefined,

      /* OPTIONS */

      option1,

      option2,

      option3,

      option_label1:
        safeNullableString(
          item.option_label1
        ),

      option_label2:
        safeNullableString(
          item.option_label2
        ),

      option_label3:
        safeNullableString(
          item.option_label3
        ),

      name:
        safeNullableString(
          item.name
        ) ??
        buildVariantName(
          option1,
          option2,
          option3
        ),

      /* SKU */

      sku:
        safeNullableString(
          item.sku
        ),

      /* PRICE */

      price,

      sale_price:
        sale_enabled
          ? sale_price
          : null,

      final_price,

      currency: "PI",

      /* SALE */

      sale_enabled,

      sale_stock:
        Math.min(
          sale_stock,
          stock
        ),

      sale_sold:
        safeNumber(
          item.sale_sold
        ),

      /* STOCK */

      stock,

      is_unlimited:
        safeBoolean(
          item.is_unlimited
        ),

      /* MEDIA */

      image:
        safeString(
          item.image
        ),

      /* STATUS */

      is_active:
        safeBoolean(
          item.is_active,
          true
        ),

      sort_order:
        safeNumber(
          item.sort_order,
          index
        ),

      /* ANALYTICS */

      sold:
        safeNumber(
          item.sold
        ),
    };

  return variant;
}

/* =========================================================
   NORMALIZE VARIANTS
========================================================= */

export function normalizeVariants(
  input: unknown
): ProductVariant[] {
  if (
    !Array.isArray(input)
  ) {
    return [];
  }

  const result: ProductVariant[] =
    [];

  for (
    let index = 0;
    index < input.length;
    index++
  ) {
    const normalized =
      normalizeVariant(
        input[index],
        index
      );

    if (!normalized) {
      continue;
    }

    result.push(
      normalized
    );
  }

  return result;
}
export function validateProductPayload(
  body: {
    name?: string;
    category_id?: number | null;
    sale_enabled?: boolean;
    sale_price?: number | null;
    sale_stock?: number;
    sale_start?: string | null;
    sale_end?: string | null;
    variants?: unknown[];
  }
): string | null {

  if (!body.category_id) {
    return "CATEGORY_REQUIRED";
  }

  if (!body.name?.trim()) {
    return "PRODUCT_NAME_REQUIRED";
  }

  const hasVariants =
    Array.isArray(body.variants) &&
    body.variants.length > 0;

  /* =========================
     PRODUCT + VARIANT SALE
  ========================= */

  if (
    hasVariants &&
    body.sale_enabled
  ) {
    return "PRODUCT_SALE_NOT_ALLOWED_WITH_VARIANTS";
  }

  /* =========================
     SALE REQUIRED FIELDS
  ========================= */

  if (
    body.sale_enabled
  ) {

    if (!body.sale_price) {
      return "SALE_PRICE_REQUIRED";
    }

    if (!body.sale_stock) {
      return "SALE_STOCK_REQUIRED";
    }

    if (!body.sale_start) {
      return "SALE_START_REQUIRED";
    }

    if (!body.sale_end) {
      return "SALE_END_REQUIRED";
    }
  }

  return null;
}

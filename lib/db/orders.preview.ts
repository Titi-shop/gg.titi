

import { query } from "@/lib/db";

/* ================= TYPES ================= */

type PreviewItemInput = {
  product_id: string;
  quantity: number;
  variant_id?: string | null;
};

type PreviewOrderInput = {
  userId: string;
  items: PreviewItemInput[];
  country: string;
  zone: string;
};

type PreviewOrderResult = {
  items: {
    product_id: string;
    name: string;
    price: number;
    quantity: number;
    total: number;
  }[];
  subtotal: number;
  shipping_fee: number;
  total: number;
};

/* ================= HELPERS ================= */

function isUUID(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f-]{36}$/i.test(v);
}

function safeQty(q: unknown): number {
  const n = Number(q);
  if (!Number.isInteger(n) || n <= 0) return 1;
  if (n > 100) return 100;
  return n;
}

/* ================= MAIN ================= */

export async function previewOrder(
  input: PreviewOrderInput
): Promise<PreviewOrderResult> {

  console.log("🟡 [ORDER][PREVIEW] START", input);

  const { userId, items, country, zone } = input;

  /* ================= VALIDATE ================= */

  if (!userId) throw new Error("INVALID_USER");

  if (!country) throw new Error("MISSING_COUNTRY");

  if (!zone) throw new Error("MISSING_REGION");

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("INVALID_ITEMS");
  }

  /* ================= CLEAN ITEMS ================= */

  const cleanItems = items.map((i) => {
    if (!isUUID(i.product_id)) {
      throw new Error("INVALID_PRODUCT_ID");
    }

    if (i.variant_id && !isUUID(i.variant_id)) {
      throw new Error("INVALID_VARIANT_ID");
    }

    return {
      product_id: i.product_id,
      variant_id: i.variant_id ?? null,
      quantity: safeQty(i.quantity),
    };
  });

  console.log("🧾 [ORDER][PREVIEW] CLEAN ITEMS:", cleanItems);

  const productIds = cleanItems.map((i) => i.product_id);

  /* ================= CHECK ZONE ================= */

  const { rows: zoneRows } = await query<{ code: string }>(
    `
    SELECT sz.code
    FROM shipping_zone_countries szc
    JOIN shipping_zones sz ON sz.id = szc.zone_id
    WHERE szc.country_code = $1
    LIMIT 1
    `,
    [country.toUpperCase()]
  );

  if (!zoneRows.length) throw new Error("INVALID_COUNTRY");

  const realZone = zoneRows[0].code;

  if (realZone !== zone) {
    throw new Error("INVALID_REGION");
  }

  console.log("🟢 [ORDER][PREVIEW] ZONE OK:", realZone);

  /* ================= LOAD PRODUCTS ================= */

  const { rows: products } = await query<{
    id: string;
    name: string;
    price: number;
    sale_price: number | null;
    sale_start: string | null;
    sale_end: string | null;
  }>(
    `
    SELECT id, name, price, sale_price, sale_start, sale_end
    FROM products
    WHERE id = ANY($1::uuid[])
    `,
    [productIds]
  );

  const productMap = new Map(products.map((p) => [p.id, p]));

  /* ================= LOAD VARIANTS ================= */

  const variantIds = cleanItems
    .map((i) => i.variant_id)
    .filter(Boolean);

  const { rows: variants } =
    variantIds.length > 0
      ? await query<{
          id: string;
          product_id: string;
          price: number;
          sale_price: number | null;
        }>(
          `
          SELECT id, product_id, price, sale_price
          FROM product_variants
          WHERE id = ANY($1::uuid[])
          `,
          [variantIds]
        )
      : { rows: [] };

  const variantMap = new Map(variants.map((v) => [v.id, v]));

  console.log("🧩 [ORDER][PREVIEW] VARIANTS:", variants);

  /* ================= CALCULATE ================= */

  const now = Date.now();

  let subtotal = 0;

  const previewItems = cleanItems.map((item) => {
    const p = productMap.get(item.product_id);

    if (!p) throw new Error("INVALID_PRODUCT");

    let price = Number(p.price);

    /* ================= VARIANT ================= */
    const start = p.sale_start
  ? new Date(p.sale_start).getTime()
  : null;

const end = p.sale_end
  ? new Date(p.sale_end).getTime()
  : null;

const isSaleTime =
  start !== null &&
  end !== null &&
  now >= start &&
  now <= end;

/* ================= VARIANT ================= */
if (item.variant_id) {
  const v = variantMap.get(item.variant_id);

  if (!v) throw new Error("INVALID_VARIANT");

  const isSale =
    isSaleTime &&
    v.sale_price &&
    v.sale_price > 0;

  price = isSale
    ? Number(v.sale_price)
    : Number(v.price);

  console.log("🎯 [PREVIEW] VARIANT PRICE:", price);

} else {
  /* ================= PRODUCT ================= */

  const isSale =
    isSaleTime &&
    p.sale_price &&
    p.sale_price > 0;

  price = isSale
    ? Number(p.sale_price)
    : Number(p.price);

  console.log("💰 [PREVIEW] PRODUCT PRICE:", price);
}

    const total = price * item.quantity;

    subtotal += total;

    return {
      product_id: p.id,
      name: p.name,
      price,
      quantity: item.quantity,
      total,
    };
  });

  console.log("🧾 [ORDER][PREVIEW] SUBTOTAL:", subtotal);

  /* ================= SHIPPING ================= */

  const { rows: shippingRows } = await query<{
    product_id: string;
    shipping_price: number;
  }>(
    `
    SELECT 
      p.id AS product_id,
      sr.price AS shipping_price
    FROM products p
    JOIN shipping_rates sr
      ON sr.product_id = p.id
    JOIN shipping_zones sz
      ON sz.id = sr.zone_id
      AND sz.code = $2
    WHERE p.id = ANY($1::uuid[])
    `,
    [productIds, realZone]
  );

  const shippingMap = new Map(
    shippingRows.map((r) => [
      r.product_id,
      Number(r.shipping_price),
    ])
  );

  let shippingFee = 0;

  for (const item of cleanItems) {
    const fee = shippingMap.get(item.product_id);

    if (fee === undefined) {
      console.error("❌ [PREVIEW] SHIPPING MISSING", item.product_id);
      throw new Error("SHIPPING_NOT_AVAILABLE");
    }

    shippingFee += fee;
  }

  console.log("🚚 [ORDER][PREVIEW] SHIPPING:", shippingFee);

  /* ================= RESULT ================= */

  const total = subtotal + shippingFee;

  console.log("🟢 [ORDER][PREVIEW] SUCCESS", {
    subtotal,
    shippingFee,
    total,
  });

  return {
    items: previewItems,
    subtotal,
    shipping_fee: shippingFee,
    total,
  };
}

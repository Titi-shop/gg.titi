import { query } from "@/lib/db";

type PreviewItemInput = {
  product_id: string;
  quantity: number;
  variant_id?: string | null; // ✅ FIX
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

export async function previewOrder(
  input: PreviewOrderInput
): Promise<PreviewOrderResult> {
  const { userId, items, country, zone } = input;

  console.log("🚀 [PREVIEW] START", input);

  if (!userId) throw new Error("INVALID_USER");
  if (!country) throw new Error("MISSING_COUNTRY");
  if (!zone) throw new Error("MISSING_REGION");

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

  if (zone !== realZone) throw new Error("INVALID_REGION");

  /* ================= VALIDATE ITEMS ================= */

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("INVALID_ITEMS");
  }

  const productIds = items.map((i) => i.product_id);

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

  const variantIds = items
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

  console.log("🧩 VARIANTS:", variants);

  /* ================= CALCULATE ================= */

  const now = Date.now();

  let subtotal = 0;

  const previewItems = items.map((item) => {
    const p = productMap.get(item.product_id);
    if (!p) throw new Error("INVALID_PRODUCT");

    const qty = item.quantity > 0 ? item.quantity : 1;

    let price = Number(p.price);

    /* ================= VARIANT ================= */
    if (item.variant_id) {
      const v = variantMap.get(item.variant_id);

      if (!v) throw new Error("INVALID_VARIANT");

      price =
        v.sale_price && v.sale_price > 0
          ? Number(v.sale_price)
          : Number(v.price);

      console.log("🎯 USING VARIANT PRICE:", price);
    } else {
      /* ================= PRODUCT SALE ================= */

      const start = p.sale_start
        ? new Date(p.sale_start).getTime()
        : null;

      const end = p.sale_end
        ? new Date(p.sale_end).getTime()
        : null;

      const isSale =
        p.sale_price &&
        start &&
        end &&
        now >= start &&
        now <= end;

      price = isSale
        ? Number(p.sale_price)
        : Number(p.price);

      console.log("💰 USING PRODUCT PRICE:", price);
    }

    const total = price * qty;

    subtotal += total;

    return {
      product_id: p.id,
      name: p.name,
      price,
      quantity: qty,
      total,
    };
  });

  /* ================= SHIPPING ================= */

  const { rows } = await query(
  `
  SELECT 
    p.id,
    p.name,

    /* 🔥 PRICE LOGIC */
    COALESCE(
      MIN(
        CASE 
          WHEN v.sale_price > 0 THEN v.sale_price
        END
      ),
      MIN(v.price),
      p.sale_price,
      p.price
    ) AS price,

    sr.price AS shipping_price

  FROM products p

  LEFT JOIN product_variants v
    ON v.product_id = p.id
    AND (v.is_active = TRUE OR v.is_active IS NULL)

  JOIN shipping_rates sr
    ON sr.product_id = p.id

  JOIN shipping_zones sz
    ON sz.id = sr.zone_id
    AND sz.code = $2

  WHERE p.id = ANY($1::uuid[])

  GROUP BY p.id, sr.price
  `,
  [productIds, realZone]
);

  const shippingMap = new Map(
    shippingRows.map((r) => [r.product_id, Number(r.price)])
  );

  let shippingFee = 0;

  for (const item of items) {
    const fee = shippingMap.get(item.product_id);

    if (fee === undefined) {
      throw new Error("SHIPPING_NOT_AVAILABLE");
    }

    shippingFee += fee; // ✅ FIX: cộng tất cả
  }

  console.log("🚚 SHIPPING TOTAL:", shippingFee);

  /* ================= RESULT ================= */

  return {
    items: previewItems,
    subtotal,
    shipping_fee: shippingFee,
    total: subtotal + shippingFee,
  };
}

import { query } from "@/lib/db";

/* =========================
   TYPES
========================= */

export type Region =
  | "domestic"
  | "sea"
  | "asia"
  | "europe"
  | "north_america"
  | "rest_of_world";

export type ShippingRateInput = {
  zone: Region;
  price: number;
};

type ShippingRateRow = {
  product_id: string;
  code: string;
  price: number;
};

/* =========================
   VALIDATE
========================= */

function isUUID(v: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(v);
}

function isValidRegion(value: string): value is Region {
  return [
    "domestic",
    "sea",
    "asia",
    "europe",
    "north_america",
    "rest_of_world",
  ].includes(value);
}

/* =========================
   UPSERT (PRODUCT BASED)
========================= */

export async function upsertShippingRates({
  productId,
  rates,
}: {
  productId: string;
  rates: ShippingRateInput[];
}) {
  console.log("🚀 [DB][SHIPPING][UPSERT] START");
  console.log("📌 PRODUCT ID:", productId);
  console.log("📦 INPUT RATES:", rates);

  if (!isUUID(productId)) {
    console.error("❌ INVALID PRODUCT ID");
    throw new Error("INVALID_PRODUCT");
  }

  if (!Array.isArray(rates)) {
    console.warn("⚠️ RATES NOT ARRAY");
    return;
  }

  /* ================= CLEAN ================= */

  const cleanRates = rates.filter((r) => {
    const valid =
      r &&
      typeof r.zone === "string" &&
      typeof r.price === "number" &&
      !Number.isNaN(r.price) &&
      r.price >= 0 &&
      isValidRegion(r.zone);

    if (!valid) {
      console.warn("⚠️ INVALID RATE:", r);
    }

    return valid;
  });

  console.log("✅ CLEAN RATES:", cleanRates);

  /* ================= DELETE OLD ================= */

  console.log("🗑️ DELETE OLD SHIPPING");

  await query(
    `
    DELETE FROM shipping_rates
    WHERE product_id = $1
    `,
    [productId]
  );

  console.log("✅ OLD SHIPPING DELETED");

  if (!cleanRates.length) {
    console.warn("⚠️ NO VALID SHIPPING → NOTHING INSERTED");
    return;
  }

  /* ================= GET ZONE MAP ================= */

  const zoneRes = await query<{ id: string; code: string }>(
    `
    SELECT id, code
    FROM shipping_zones
    WHERE code = ANY($1)
    `,
    [cleanRates.map((r) => r.zone)]
  );

  console.log("🗺️ ZONE MAP RAW:", zoneRes.rows);

  const zoneMap = new Map(
    zoneRes.rows.map((z) => [z.code, z.id])
  );

  console.log("🗺️ ZONE MAP FINAL:", zoneMap);

  /* ================= INSERT ================= */

  const values: unknown[] = [];
  const placeholders: string[] = [];

  let idx = 1;

  for (const r of cleanRates) {
    const zoneId = zoneMap.get(r.zone);

    if (!zoneId) {
      console.warn("⚠️ ZONE NOT FOUND:", r.zone);
      continue;
    }

    placeholders.push(`($${idx++}, $${idx++}, $${idx++})`);
    values.push(productId, zoneId, r.price);
  }

  if (!placeholders.length) {
    console.warn("⚠️ NOTHING TO INSERT");
    return;
  }

  console.log("📥 INSERT VALUES:", values);

  await query(
    `
    INSERT INTO shipping_rates (product_id, zone_id, price)
    VALUES ${placeholders.join(",")}
    `,
    values
  );

  console.log("🎉 SHIPPING UPSERT SUCCESS");
}

/* =========================
   GET — SINGLE PRODUCT
========================= */

export async function getShippingRatesByProduct(
  productId: string
): Promise<ShippingRateInput[]> {
  console.log("🚀 [DB][SHIPPING][GET ONE] START:", productId);

  if (!isUUID(productId)) {
    console.error("❌ INVALID PRODUCT ID");
    throw new Error("INVALID_PRODUCT");
  }

  const { rows } = await query<{
    code: string;
    price: number;
  }>(
    `
    SELECT 
      sr.product_id,
      sz.code,
      sr.price
    FROM shipping_rates sr
    JOIN shipping_zones sz 
      ON sz.id = sr.zone_id
    WHERE sr.product_id = $1
    `,
    [productId]
  );

  console.log("📦 RAW ROWS:", rows);

  if (!rows.length) {
    console.warn("⚠️ NO SHIPPING FOUND IN DB");
  }

  const result = rows
    .filter((r) => {
      const valid = isValidRegion(r.code);

      if (!valid) {
        console.warn("⚠️ INVALID REGION:", r.code);
      }

      return valid;
    })
    .map((r) => ({
      zone: r.code,
      price: Number(r.price),
    }));

  console.log("✅ FINAL SHIPPING:", result);

  return result;
}

/* =========================
   GET — MULTIPLE PRODUCTS
========================= */

export async function getShippingRatesByProducts(
  productIds: string[]
): Promise<
  { product_id: string; zone: Region; price: number }[]
> {
  console.log("🚀 [DB][SHIPPING][MULTI] START:", productIds);

  if (!Array.isArray(productIds)) {
    console.warn("⚠️ productIds NOT ARRAY");
    return [];
  }

  const validIds = productIds.filter(isUUID);

  if (!validIds.length) {
    console.warn("⚠️ NO VALID IDS");
    return [];
  }

  const { rows } = await query<ShippingRateRow>(
    `
    SELECT 
      sr.product_id,
      sz.code,
      sr.price
    FROM shipping_rates sr
    JOIN shipping_zones sz 
      ON sz.id = sr.zone_id
    WHERE sr.product_id = ANY($1::uuid[])
    `,
    [validIds]
  );

  console.log("📦 MULTI RAW:", rows);

  if (!rows.length) {
    console.warn("⚠️ NO SHIPPING FOUND FOR ANY PRODUCT");
  }

  const result = rows
    .filter((r) => {
      const valid = isValidRegion(r.code);

      if (!valid) {
        console.warn("⚠️ INVALID REGION:", r.code);
      }

      return valid;
    })
    .map((r) => ({
      product_id: r.product_id,
      zone: r.code,
      price: Number(r.price),
    }));

  console.log("✅ MULTI FINAL:", result);

  return result;
}

/* =========================
   ZONE BY COUNTRY
========================= */

export async function getZoneByCountry(
  countryCode: string
): Promise<string | null> {
  console.log("🌍 [DB][ZONE] COUNTRY:", countryCode);

  if (!countryCode) return null;

  const { rows } = await query<{ code: string }>(
    `
    SELECT sz.code
    FROM shipping_zone_countries szc
    JOIN shipping_zones sz ON sz.id = szc.zone_id
    WHERE szc.country_code = $1
    LIMIT 1
    `,
    [countryCode.toUpperCase()]
  );

  console.log("🌍 [DB][ZONE] RESULT:", rows);

  return rows[0]?.code ?? null;
}

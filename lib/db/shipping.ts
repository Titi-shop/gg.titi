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
  if (!isUUID(productId)) {
    throw new Error("INVALID_PRODUCT");
  }

  if (!Array.isArray(rates)) return;

  const cleanRates = rates.filter(
    (r) =>
      r &&
      typeof r.zone === "string" &&
      typeof r.price === "number" &&
      !Number.isNaN(r.price) &&
      r.price >= 0 &&
      isValidRegion(r.zone)
  );

  /* ================= DELETE OLD ================= */

  await query(
    `
    DELETE FROM shipping_rates
    WHERE product_id = $1
    `,
    [productId]
  );

  if (!cleanRates.length) return;

  /* ================= GET ZONE MAP ================= */

  const zoneRes = await query<{ id: string; code: string }>(
    `
    SELECT id, code
    FROM shipping_zones
    WHERE code = ANY($1)
    `,
    [cleanRates.map((r) => r.zone)]
  );

  const zoneMap = new Map(
    zoneRes.rows.map((z) => [z.code, z.id])
  );

  /* ================= INSERT ================= */

  const values: unknown[] = [];
  const placeholders: string[] = [];

  let idx = 1;

  for (const r of cleanRates) {
    const zoneId = zoneMap.get(r.zone);
    if (!zoneId) continue;

    placeholders.push(`($${idx++}, $${idx++}, $${idx++})`);
    values.push(productId, zoneId, r.price);
  }

  if (!placeholders.length) return;

  await query(
    `
    INSERT INTO shipping_rates (product_id, zone_id, price)
    VALUES ${placeholders.join(",")}
    `,
    values
  );
}

/* =========================
   GET — SINGLE PRODUCT
========================= */

export async function getShippingRatesByProduct(
  productId: string
): Promise<ShippingRateInput[]> {
  console.log("🚚 [DB][SHIPPING] GET START:", productId);

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

  console.log("📦 [DB][SHIPPING] RAW ROWS:", rows);

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

  console.log("✅ [DB][SHIPPING] FINAL:", result);

  return result;
}

/* =========================
   ZONE BY COUNTRY
========================= */

export async function getZoneByCountry(
  countryCode: string
): Promise<string | null> {
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

  return rows[0]?.code ?? null;
}

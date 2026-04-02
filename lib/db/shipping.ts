import { query } from "@/lib/db";

export async function upsertShippingRates({
  sellerId,
  rates,
}: {
  sellerId: string;
  rates: { zone: string; price: number }[];
}) {
  if (!sellerId) throw new Error("INVALID_USER");

  if (!Array.isArray(rates)) return;

  const cleanRates = rates.filter(
    (r) =>
      r &&
      typeof r.zone === "string" &&
      typeof r.price === "number" &&
      !Number.isNaN(r.price) &&
      r.price >= 0
  );

  if (cleanRates.length === 0) return;

  // ✅ lấy zone 1 lần (rule #31 OK)
  const zoneRes = await query<{ id: string; code: string }>(
    `
    select id, code
    from shipping_zones
    where code = any($1)
    `,
    [cleanRates.map((r) => r.zone)]
  );

  const zoneMap = new Map(
    zoneRes.rows.map((z) => [z.code, z.id])
  );

  // ✅ delete old
  await query(
    `delete from shipping_rates where seller_id = $1`,
    [sellerId]
  );

  // ✅ insert mới
  for (const r of cleanRates) {
    const zoneId = zoneMap.get(r.zone);
    if (!zoneId) continue;

    await query(
      `
      insert into shipping_rates (zone_id, seller_id, price)
      values ($1,$2,$3)
      `,
      [zoneId, sellerId, r.price]
    );
  }
}

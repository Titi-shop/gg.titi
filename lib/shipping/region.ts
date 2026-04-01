// lib/shipping/region.ts

export type Region = "domestic" | "asia" | "international";

export function getRegionFromCountry(country?: string): Region {
  if (!country) return "international";

  if (country === "VN") return "domestic";

  const asiaCountries = ["JP", "KR", "CN", "TH", "SG"];

  if (asiaCountries.includes(country)) return "asia";

  return "international";
}

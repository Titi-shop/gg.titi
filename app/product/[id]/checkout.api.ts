import { getPiAccessToken } from "@/lib/piAuth";
import type {
  PreviewPayload,
  PreviewResponse,
  AddressApiResponse,
  ShippingInfo,
} from "./checkout.types";

/* =========================
   PREVIEW FETCHER
========================= */

export const previewFetcher = async (
  [url, payload]: [string, PreviewPayload]
): Promise<PreviewResponse> => {
  const token = await getPiAccessToken();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "PREVIEW_FAILED");
  }

  return data as PreviewResponse;
};

/* =========================
   LOAD ADDRESS
========================= */

export async function fetchDefaultAddress(): Promise<ShippingInfo | null> {
  try {
    console.log("🟡 [CHECKOUT] LOAD ADDRESS START");

    const token = await getPiAccessToken();
    console.log("🟢 TOKEN:", token);

    const res = await fetch("/api/address", {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("🟢 ADDRESS RES:", res.status);

    if (!res.ok) return null;

    const data: AddressApiResponse = await res.json();
    console.log("🟢 ADDRESS DATA:", data);

    const def = data.items?.find((a) => a.is_default);
    if (!def) return null;

    const shipping: ShippingInfo = {
      name: def.full_name,
      phone: def.phone,
      address_line: def.address_line,
      province: def.province,
      country: def.country,
      postal_code: def.postal_code ?? null,
    };

    console.log("🟢 SHIPPING SET");

    return shipping;
  } catch (err) {
    console.error("❌ LOAD ADDRESS ERROR:", err);
    return null;
  }
}

/* =========================
   HELPER
========================= */

export function getCountryDisplay(country?: string) {
  return country ?? "";
}

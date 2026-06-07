"use client";

import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

/* =========================================================
TYPES
========================================================= */

export type PreviewKey = [
  url: string,
  address_id: string,
  quantity: number,
  product_id: string,
  variant_id: string | null
];

export interface PreviewResponse {
  buyer_zone: string;
  subtotal: number;
  shipping: number;
  total: number;
}

export interface AddressItem {
  id: string;
  full_name: string;
  phone: string;
  address_line: string;
  region: string;
  district?: string | null;
  ward?: string | null;
  country?: string | null;
  postal_code?: string | null;
  is_default: boolean;
}

export interface AddressResponse {
  items: AddressItem[];
}

export interface ShippingAddress {
  id: string;
  name: string;
  phone: string;
  address_line: string;
  region: string;
  district: string;
  ward: string;
  country: string;
  postal_code: string | null;
}

/* =========================================================
PREVIEW FETCHER
========================================================= */

export async function previewFetcher(
  key: PreviewKey
): Promise<PreviewResponse> {
  const [
    url,
    address_id,
    quantity,
    product_id,
    variant_id,
  ] = key;

  console.log("[API PREVIEW CALL]", {
    address_id,
    quantity,
    product_id,
    variant_id,
  });

  const res = await apiAuthFetch(url, {
    method: "POST",
    body: JSON.stringify({
      address_id,
      items: [
        {
          product_id,
          variant_id,
          quantity,
        },
      ],
    }),
  });

  const data: PreviewResponse = await res.json();

  if (!res.ok) {
    throw new Error("PREVIEW_FAILED");
  }

  console.log("[PREVIEW RESPONSE]", data);

  return data;
}

/* =========================================================
DEFAULT ADDRESS
========================================================= */

export async function fetchDefaultAddress(): Promise<ShippingAddress | null> {
  try {
    const res = await apiAuthFetch("/api/address");

    if (!res.ok) {
      return null;
    }

    const data: AddressResponse = await res.json();

    const items = Array.isArray(data.items)
      ? data.items
      : [];

    const def = items.find((a) => a.is_default);

    if (!def) {
      return null;
    }

    return {
      id: def.id,
      name: def.full_name,
      phone: def.phone,
      address_line: def.address_line,
      region: def.region,
      district: def.district ?? "",
      ward: def.ward ?? "",
      country: def.country ?? "",
      postal_code: def.postal_code ?? null,
    };
  } catch (error) {
    console.error("[ADDRESS LOAD ERROR]", error);
    return null;
  }
}

/* =========================================================
COUNTRY DISPLAY
========================================================= */

export function getCountryDisplay(
  country?: string | null
): string {
  return country?.toUpperCase() ?? "";
           }

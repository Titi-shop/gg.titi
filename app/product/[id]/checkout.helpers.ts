export function getCountryDisplay(country?: string) {
  return country ?? "";
}

export function getErrorKey(code?: string) {
  const map: Record<string, string> = {
    UNSUPPORTED_COUNTRY: "unsupported_country",
    PREVIEW_FAILED: "order_preview_failed",
    INVALID_REGION: "invalid_region",
    SHIPPING_NOT_AVAILABLE: "shipping_not_available",
  };

  return map[code || ""] || "unknown_error";
}

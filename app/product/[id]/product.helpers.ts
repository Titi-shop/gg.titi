/* ================= DETAIL ================= */

export function formatDetail(text: string) {
  if (!text) return "";

  const normalized = text
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  // ⚠️ basic escape để tránh XSS nhẹ
  const safe = normalized
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return safe.replace(/\n/g, "<br/>");
}

/* ================= SHORT DESCRIPTION ================= */

export function formatShortDescription(text?: string) {
  if (!text || typeof text !== "string") return [];

  return text
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/* ================= SALE ================= */

export function calcSalePercent(price: number, finalPrice: number) {
  if (!price || price <= 0) return 0; // ✅ fix chia 0
  if (finalPrice >= price) return 0;

  return Math.round(((price - finalPrice) / price) * 100);
}

/* ================= TOUCH DISTANCE ================= */

export function getDistance(touches: TouchList) {
  if (!touches || touches.length < 2) return 0; // ✅ tránh crash

  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;

  return Math.sqrt(dx * dx + dy * dy);
}

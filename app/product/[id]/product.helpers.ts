Kiểm tra app/product/[id]/product.helpers.ts
Cho đồng bộ .

export function formatDetail(text: string) {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "<br/>")
    .trim();
}

export function formatShortDescription(text?: string) {
  if (!text || typeof text !== "string") return [];

  return text
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function calcSalePercent(price: number, finalPrice: number) {
  if (finalPrice >= price) return 0;
  return Math.round(((price - finalPrice) / price) * 100);
}

export function getDistance(touches: TouchList) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/* =========================================================
   PI FORMAT UTIL
   dùng khi hiển thị giá Pi
========================================================= */

/* format hiển thị 5 số thập phân */
export function formatPi(value: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0.00000";
  }

  const parts = value.toFixed(5).split(".");
  const integer = Number(parts[0]).toLocaleString("en-US");
  const decimal = parts[1];

  return `${integer}.${decimal}`;
}

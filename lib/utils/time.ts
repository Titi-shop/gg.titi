export function toLocalInput(date?: string | null) {
  if (!date) return "";

  const d = new Date(date);
  const offset = d.getTimezoneOffset();

  const local = new Date(d.getTime() - offset * 60000);

  return local.toISOString().slice(0, 16);
}

export function toUTCFromInput(value: string) {
  if (!value) return null;

  return new Date(value).toISOString();
}

export function formatDisplayTime(date?: string | null) {
  if (!date) return "";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}
/* ================= SALE TIME ================= */

export function toTimestamp(date?: string | null): number | null {
  if (!date) return null;

  const t = new Date(date).getTime();
  return Number.isNaN(t) ? null : t;
}

export function isNowInRange(
  start?: string | null,
  end?: string | null
): boolean {
  const now = Date.now();

  const s = toTimestamp(start);
  const e = toTimestamp(end);

  if (!s || !e) return false;

  return now >= s && now <= e;
}

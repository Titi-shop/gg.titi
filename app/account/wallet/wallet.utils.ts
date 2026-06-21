// =====================================================
// app/account/wallet/wallet.utils.ts
// =====================================================
import {
  ENTRY_LABELS,
} from "./wallet.constants";
import type {
  JournalEntryType,
} from "@/lib/db/wallet/wallet.types";
/* =====================================================
   FORMAT PI
===================================================== */
export function formatPi(
  value: number
): string {
  return value.toFixed(2);
}
/* =====================================================
   FORMAT TIME
===================================================== */
export function formatTime(
  date: string
): string {
  return new Date(
    date
  ).toLocaleString();
}
/* =====================================================
   ENTRY LABEL
===================================================== */
export function getEntryLabel(
  type: JournalEntryType
): string {
  return (
    ENTRY_LABELS[type] ??
    type
  );
}
/* =====================================================
   SAFE NUMBER
===================================================== */
export function toSafeNumber(
  value: unknown
): number {
  const number =
    Number(value);
  if (
    Number.isNaN(number)
  ) {
    return 0;
  }
  return number;
}

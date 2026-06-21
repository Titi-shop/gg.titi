// =====================================================
// app/account/wallet/components/WalletTransactionItem.tsx
// =====================================================

"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";

import type {
  WalletTransaction,
} from "../wallet.api";

import {
  formatPi,
  formatTime,
  getEntryLabel,
} from "../wallet.utils";

/* =====================================================
   TYPES
===================================================== */

type Props = {
  item: WalletTransaction;
};

/* =====================================================
   COMPONENT
===================================================== */

export default function WalletTransactionItem({
  item,
}: Props) {

  const isCredit =
    item.direction ===
    "CREDIT";

  return (
    <div
      className="
        flex items-center
        justify-between gap-4
        border-b border-orange-500/5
        p-4 last:border-b-0
      "
    >

      {/* LEFT */}
      <div
        className="
          flex min-w-0
          items-center gap-3
        "
      >

        <div
          className={`
            flex h-12 w-12
            shrink-0 items-center
            justify-center rounded-2xl
            ${
              isCredit
                ? "bg-green-500/10 text-green-500"
                : "bg-red-500/10 text-red-500"
            }
          `}
        >
          {isCredit ? (
            <ArrowDownLeft
              size={20}
            />
          ) : (
            <ArrowUpRight
              size={20}
            />
          )}
        </div>

        <div className="min-w-0">

          <p
            className="
              truncate text-sm
              font-semibold
              text-[var(--foreground)]
            "
          >
            {getEntryLabel(
              item.entry_type
            )}
          </p>

          <p
            className="
              mt-1 text-xs
              text-[var(--text-muted)]
            "
          >
            {formatTime(
              item.created_at
            )}
          </p>
        </div>
      </div>

      {/* RIGHT */}
      <div className="text-right">

        <p
          className={`
            text-sm font-bold
            ${
              isCredit
                ? "text-green-500"
                : "text-red-500"
            }
          `}
        >
          {isCredit
            ? "+"
            : "-"}

          π
          {formatPi(
            item.amount
          )}
        </p>
      </div>
    </div>
  );
}

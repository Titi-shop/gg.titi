// =====================================================
// app/account/wallet/components/WalletTransactionList.tsx
// =====================================================

"use client";

import {
  Wallet,
} from "lucide-react";

import {
  useTranslationClient as useTranslation,
} from "@/app/lib/i18n/client";

import type {
  WalletTransaction,
} from "../wallet.api";

import WalletTransactionItem
  from "./WalletTransactionItem";

/* =====================================================
   TYPES
===================================================== */

type Props = {
  transactions:
    WalletTransaction[];
};

/* =====================================================
   COMPONENT
===================================================== */

export default function WalletTransactionList({
  transactions,
}: Props) {

  const { t } =
    useTranslation();

  return (
    <section className="mt-6 px-4">

      <div
        className="
          mb-3 flex items-center
          justify-between
        "
      >

        <h2
          className="
            text-base font-bold
            text-[var(--foreground)]
          "
        >
          {t.wallet_transactions ??
            "Transactions"}
        </h2>

        <span
          className="
            text-xs
            text-[var(--text-muted)]
          "
        >
          {transactions.length}
        </span>
      </div>

      <div
        className="
          overflow-hidden rounded-3xl
          border border-orange-500/10
          bg-[var(--card-bg)]
          shadow-sm
        "
      >

        {transactions.length === 0 && (

          <div className="p-10 text-center">

            <div
              className="
                mx-auto flex h-16 w-16
                items-center justify-center
                rounded-full
                bg-orange-500/10
                text-orange-500
              "
            >
              <Wallet
                size={28}
              />
            </div>

            <p
              className="
                mt-4 text-sm
                text-[var(--text-muted)]
              "
            >
              {t.wallet_no_transactions ??
                "No transactions yet"}
            </p>
          </div>
        )}

        {transactions.map(
          (item) => (
            <WalletTransactionItem
              key={item.id}
              item={item}
            />
          )
        )}

      </div>
    </section>
  );
}

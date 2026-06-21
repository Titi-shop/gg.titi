// =====================================================
// app/account/wallet/components/WalletStats.tsx
// =====================================================

"use client";

import {
  PiggyBank,
  Wallet,
} from "lucide-react";

import {
  useTranslationClient as useTranslation,
} from "@/app/lib/i18n/client";

import {
  formatPi,
} from "../wallet.utils";

/* =====================================================
   TYPES
===================================================== */

type Props = {
  totalIn: number;
  totalOut: number;
};

/* =====================================================
   COMPONENT
===================================================== */

export default function WalletStats({
  totalIn,
  totalOut,
}: Props) {

  const { t } =
    useTranslation();

  return (
    <section className="px-4 pt-5">

      <div className="grid grid-cols-2 gap-4">

        {/* IN */}
        <div
          className="
            rounded-3xl
            border border-green-500/10
            bg-[var(--card-bg)]
            p-5 shadow-sm
          "
        >

          <div
            className="
              flex h-12 w-12
              items-center justify-center
              rounded-2xl
              bg-green-500/10
              text-green-500
            "
          >
            <PiggyBank
              size={22}
            />
          </div>

          <p
            className="
              mt-4 text-xs
              text-[var(--text-muted)]
            "
          >
            {t.wallet_total_in ??
              "Total In"}
          </p>

          <p
            className="
              mt-1 text-2xl
              font-bold text-green-500
            "
          >
            +π {formatPi(totalIn)}
          </p>
        </div>

        {/* OUT */}
        <div
          className="
            rounded-3xl
            border border-red-500/10
            bg-[var(--card-bg)]
            p-5 shadow-sm
          "
        >

          <div
            className="
              flex h-12 w-12
              items-center justify-center
              rounded-2xl
              bg-red-500/10
              text-red-500
            "
          >
            <Wallet
              size={22}
            />
          </div>

          <p
            className="
              mt-4 text-xs
              text-[var(--text-muted)]
            "
          >
            {t.wallet_total_out ??
              "Total Out"}
          </p>

          <p
            className="
              mt-1 text-2xl
              font-bold text-red-500
            "
          >
            -π {formatPi(totalOut)}
          </p>
        </div>

      </div>
    </section>
  );
}

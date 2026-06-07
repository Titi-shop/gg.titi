"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  PiggyBank,
  RefreshCcw,
  Wallet,
} from "lucide-react";

import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* =======================================================
   TYPES
======================================================= */

type TransactionType =
  | "credit"
  | "debit";

type ReferenceType =
  | "order"
  | "refund"
  | "withdraw"
  | "deposit"
  | string;

type WalletResponse = {
  balance?: number | string;
};

type Tx = {
  id: string;
  type: TransactionType;
  amount: number;
  reference_type: ReferenceType;
  created_at: string;
};

type TransactionApiItem = {
  id?: unknown;
  type?: unknown;
  amount?: unknown;
  reference_type?: unknown;
  created_at?: unknown;
};

/* =======================================================
   UTILS
======================================================= */

function formatPi(value: number): string {
  return Number(value).toFixed(2);
}

function formatTime(date: string): string {
  return new Date(date).toLocaleString();
}

function isWalletResponse(
  value: unknown
): value is WalletResponse {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function isTransactionApiItem(
  value: unknown
): value is TransactionApiItem {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function parseTransaction(
  value: unknown
): Tx | null {
  if (!isTransactionApiItem(value)) {
    return null;
  }

  const {
    id,
    type,
    amount,
    reference_type,
    created_at,
  } = value;

  if (
    typeof id !== "string" ||
    (type !== "credit" &&
      type !== "debit") ||
    typeof reference_type !==
      "string" ||
    typeof created_at !== "string"
  ) {
    return null;
  }

  const parsedAmount = Number(amount);

  return {
    id,
    type,
    amount: Number.isNaN(parsedAmount)
      ? 0
      : parsedAmount,
    reference_type,
    created_at,
  };
}

/* =======================================================
   PAGE
======================================================= */

export default function WalletPage() {
  const { t } = useTranslation();

  const {
    loading: authLoading,
  } = useAuth();

  const [balance, setBalance] =
    useState<number>(0);

  const [txs, setTxs] = useState<Tx[]>(
    []
  );

  const [loading, setLoading] =
    useState<boolean>(true);

  const [refreshing, setRefreshing] =
    useState<boolean>(false);

  const hasLoaded =
    useRef<boolean>(false);

  /* =======================================================
     LOAD
  ======================================================= */

  useEffect(() => {
    if (authLoading) return;

    if (hasLoaded.current) return;

    hasLoaded.current = true;

    void load();
  }, [authLoading]);

  async function load(): Promise<void> {
    try {
      const [walletRes, txRes] =
        await Promise.all([
          apiAuthFetch("/api/wallet", {
            cache: "no-store",
          }),

          apiAuthFetch(
            "/api/wallet/transactions",
            {
              cache: "no-store",
            }
          ),
        ]);

      /* ================= WALLET ================= */

      if (walletRes.ok) {
        const walletJson: unknown =
          await walletRes.json();

        if (
          isWalletResponse(walletJson)
        ) {
          const parsedBalance =
            Number(
              walletJson.balance ?? 0
            );

          setBalance(
            Number.isNaN(parsedBalance)
              ? 0
              : parsedBalance
          );
        }
      }

      /* ================= TRANSACTIONS ================= */

      if (txRes.ok) {
        const txJson: unknown =
          await txRes.json();

        if (Array.isArray(txJson)) {
          const safeTxs = txJson
            .map(parseTransaction)
            .filter(
              (
                item
              ): item is Tx =>
                item !== null
            );

          setTxs(safeTxs);
        }
      }
    } catch (error) {
      console.error(
        "❌ WALLET LOAD ERROR",
        error
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function refresh(): Promise<void> {
    if (refreshing) return;

    setRefreshing(true);

    await load();
  }

  /* =======================================================
     LABELS
  ======================================================= */

  function getRefLabel(
    type: ReferenceType
  ): string {
    switch (type) {
      case "order":
        return (
          t.wallet_ref_order ??
          "Order Payment"
        );

      case "refund":
        return (
          t.wallet_ref_refund ??
          "Refund"
        );

      case "withdraw":
        return (
          t.wallet_ref_withdraw ??
          "Withdraw"
        );

      case "deposit":
        return (
          t.wallet_ref_deposit ??
          "Deposit"
        );

      default:
        return type;
    }
  }

  /* =======================================================
     STATS
  ======================================================= */

  const totalIn = useMemo(() => {
    return txs
      .filter(
        (item) =>
          item.type === "credit"
      )
      .reduce(
        (acc, item) =>
          acc + item.amount,
        0
      );
  }, [txs]);

  const totalOut = useMemo(() => {
    return txs
      .filter(
        (item) =>
          item.type === "debit"
      )
      .reduce(
        (acc, item) =>
          acc + item.amount,
        0
      );
  }, [txs]);

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)] p-4">

        <div
          className="
            h-52 animate-pulse rounded-3xl
            bg-[var(--card-secondary)]
          "
        />

        <div className="mt-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="
                h-20 animate-pulse rounded-2xl
                bg-[var(--card-secondary)]
              "
            />
          ))}
        </div>

      </main>
    );
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <main className="min-h-screen bg-[var(--background)] pb-28 transition-colors duration-300">

      {/* =======================================================
          HERO
      ======================================================= */}

      <section
        className="
          relative overflow-hidden
          rounded-b-[2.5rem]
          border-b border-orange-500/10
          bg-gradient-to-br
          from-orange-500
          via-orange-500
          to-amber-500
          px-5 pb-8 pt-8
          text-white
          shadow-xl
        "
      >
        {/* glow */}
        <div
          className="
            absolute -right-10 -top-10
            h-40 w-40 rounded-full
            bg-white/10 blur-3xl
          "
        />

        <div
          className="
            absolute bottom-0 left-0
            h-32 w-32 rounded-full
            bg-yellow-300/10 blur-3xl
          "
        />

        {/* top */}
        <div className="relative z-10 flex items-start justify-between gap-4">

          <div>
            <p className="text-sm text-white/80">
              {t.wallet_balance ??
                "Wallet Balance"}
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight">
              π {formatPi(balance)}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => {
              void refresh();
            }}
            className="
              flex h-11 w-11 items-center justify-center
              rounded-2xl
              border border-white/20
              bg-white/10
              backdrop-blur-md
              transition-all duration-200
              active:scale-95
            "
          >
            <RefreshCcw
              size={18}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />
          </button>

        </div>

        {/* actions */}
        <div className="relative z-10 mt-8 grid grid-cols-3 gap-3">

          <button
            type="button"
            className="
              rounded-2xl
              border border-white/15
              bg-white/10
              p-3
              backdrop-blur-md
              transition-all duration-200
              active:scale-95
            "
          >
            <div
              className="
                mx-auto flex h-11 w-11
                items-center justify-center
                rounded-xl bg-white/15
              "
            >
              <ArrowDownLeft size={20} />
            </div>

            <p className="mt-2 text-xs font-semibold">
              {t.wallet_deposit ??
                "Deposit"}
            </p>
          </button>

          <button
            type="button"
            className="
              rounded-2xl
              border border-white/15
              bg-white/10
              p-3
              backdrop-blur-md
              transition-all duration-200
              active:scale-95
            "
          >
            <div
              className="
                mx-auto flex h-11 w-11
                items-center justify-center
                rounded-xl bg-white/15
              "
            >
              <ArrowUpRight size={20} />
            </div>

            <p className="mt-2 text-xs font-semibold">
              {t.wallet_withdraw ??
                "Withdraw"}
            </p>
          </button>

          <button
            type="button"
            className="
              rounded-2xl
              border border-white/15
              bg-white/10
              p-3
              backdrop-blur-md
              transition-all duration-200
              active:scale-95
            "
          >
            <div
              className="
                mx-auto flex h-11 w-11
                items-center justify-center
                rounded-xl bg-white/15
              "
            >
              <CreditCard size={20} />
            </div>

            <p className="mt-2 text-xs font-semibold">
              {t.wallet_pay ??
                "Pay"}
            </p>
          </button>

        </div>
      </section>

      {/* =======================================================
          STATS
      ======================================================= */}

      <section className="px-4 pt-5">
        <div className="grid grid-cols-2 gap-4">

          {/* IN */}
          <div
            className="
              rounded-3xl
              border border-green-500/10
              bg-[var(--card-bg)]
              p-5
              shadow-sm
            "
          >
            <div
              className="
                flex h-12 w-12 items-center justify-center
                rounded-2xl
                bg-green-500/10
                text-green-500
              "
            >
              <PiggyBank size={22} />
            </div>

            <p className="mt-4 text-xs text-[var(--text-muted)]">
              {t.wallet_total_in ??
                "Total In"}
            </p>

            <p className="mt-1 text-2xl font-bold text-green-500">
              +π {formatPi(totalIn)}
            </p>
          </div>

          {/* OUT */}
          <div
            className="
              rounded-3xl
              border border-red-500/10
              bg-[var(--card-bg)]
              p-5
              shadow-sm
            "
          >
            <div
              className="
                flex h-12 w-12 items-center justify-center
                rounded-2xl
                bg-red-500/10
                text-red-500
              "
            >
              <Wallet size={22} />
            </div>

            <p className="mt-4 text-xs text-[var(--text-muted)]">
              {t.wallet_total_out ??
                "Total Out"}
            </p>

            <p className="mt-1 text-2xl font-bold text-red-500">
              -π {formatPi(totalOut)}
            </p>
          </div>

        </div>
      </section>

      {/* =======================================================
          TRANSACTIONS
      ======================================================= */}

      <section className="mt-6 px-4">

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-[var(--foreground)]">
            {t.wallet_transactions ??
              "Transactions"}
          </h2>

          <span className="text-xs text-[var(--text-muted)]">
            {txs.length}
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

          {txs.length === 0 && (
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
                <Wallet size={28} />
              </div>

              <p className="mt-4 text-sm text-[var(--text-muted)]">
                {t.wallet_no_transactions ??
                  "No transactions yet"}
              </p>

            </div>
          )}

          {txs.map((item) => {
            const isCredit =
              item.type === "credit";

            return (
              <div
                key={item.id}
                className="
                  flex items-center justify-between gap-4
                  border-b border-orange-500/5
                  p-4 last:border-b-0
                "
              >

                {/* left */}
                <div className="flex min-w-0 items-center gap-3">

                  <div
                    className={`
                      flex h-12 w-12 shrink-0 items-center justify-center
                      rounded-2xl
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
                        truncate text-sm font-semibold
                        text-[var(--foreground)]
                      "
                    >
                      {getRefLabel(
                        item.reference_type
                      )}
                    </p>

                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {formatTime(
                        item.created_at
                      )}
                    </p>

                  </div>
                </div>

                {/* amount */}
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
          })}

        </div>
      </section>
    </main>
  );
}

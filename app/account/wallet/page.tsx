"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* ================= TYPES ================= */

type Tx = {
  id: string;
  type: "credit" | "debit";
  amount: number;
  reference_type: string;
  created_at: string;
};

/* ================= UTILS ================= */

function formatPi(value: number): string {
  return Number(value).toFixed(2);
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString();
}

/* ================= PAGE ================= */

export default function WalletPage() {
  const { t } = useTranslation();

  const { loading: authLoading } = useAuth();

  const [balance, setBalance] = useState<number>(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const hasLoaded = useRef<boolean>(false);

  /* ================= LOAD ================= */

  useEffect(() => {
    if (authLoading) return;
    if (hasLoaded.current) return;

    hasLoaded.current = true;
    load();
  }, [authLoading]);

  async function load(): Promise<void> {
    try {
      console.log("🟡 [WALLET][LOAD]");

      const [walletRes, txRes] = await Promise.all([
        apiAuthFetch("/api/wallet", { cache: "no-store" }),
        apiAuthFetch("/api/wallet/transactions", { cache: "no-store" }),
      ]);

      /* ================= WALLET ================= */

      if (walletRes.ok) {
        const walletJson: unknown = await walletRes.json();

        if (
          typeof walletJson === "object" &&
          walletJson !== null &&
          "balance" in walletJson
        ) {
          const balanceValue = Number(
            (walletJson as { balance: unknown }).balance
          );

          setBalance(Number.isNaN(balanceValue) ? 0 : balanceValue);
        }
      }

      /* ================= TRANSACTIONS ================= */

      if (txRes.ok) {
        const txJson: unknown = await txRes.json();

        if (Array.isArray(txJson)) {
          const safeTx: Tx[] = txJson.filter(
            (t): t is Tx =>
              typeof t === "object" &&
              t !== null &&
              typeof t.id === "string" &&
              (t.type === "credit" || t.type === "debit") &&
              typeof t.amount !== "undefined" &&
              typeof t.reference_type === "string" &&
              typeof t.created_at === "string"
          );

          setTxs(safeTx);
        }
      }

      console.log("🟢 [WALLET][LOAD_SUCCESS]");
    } catch (err) {
      console.error("❌ [WALLET][LOAD_ERROR]", err);
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

  /* ================= UI ================= */

  if (loading) {
    return (
      <main className="p-4 space-y-4 animate-pulse">
        <div className="h-24 bg-gray-200 rounded-xl" />
        <div className="h-40 bg-gray-200 rounded-xl" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* HEADER */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-5 rounded-b-2xl shadow">

        <div className="flex justify-between items-center">
          <p className="text-sm opacity-80">
            {t("wallet.balance")}
          </p>

          <button
            onClick={refresh}
            className="text-xs bg-white/20 px-3 py-1 rounded-full"
          >
            {refreshing
              ? "..."
              : t("wallet.refresh")}
          </button>
        </div>

        <h1 className="text-3xl font-bold mt-2">
          π {formatPi(balance)}
        </h1>

        {/* ACTIONS */}
        <div className="flex gap-3 mt-5">

          <button className="flex-1 bg-white text-orange-600 py-2 rounded-xl text-sm font-semibold">
            {t("wallet.deposit")}
          </button>

          <button className="flex-1 bg-white text-orange-600 py-2 rounded-xl text-sm font-semibold">
            {t("wallet.withdraw")}
          </button>

          <button className="flex-1 bg-white text-orange-600 py-2 rounded-xl text-sm font-semibold">
            {t("wallet.pay")}
          </button>

        </div>
      </div>

      {/* QUICK STATS */}
      <div className="p-4 grid grid-cols-2 gap-3">

        <div className="bg-white p-4 rounded-xl shadow">
          <p className="text-xs text-gray-400">
            {t("wallet.total_in")}
          </p>
          <p className="text-green-600 font-semibold">
            +π{" "}
            {formatPi(
              txs
                .filter((t) => t.type === "credit")
                .reduce((sum, t) => sum + Number(t.amount), 0)
            )}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow">
          <p className="text-xs text-gray-400">
            {t("wallet.total_out")}
          </p>
          <p className="text-red-500 font-semibold">
            -π{" "}
            {formatPi(
              txs
                .filter((t) => t.type === "debit")
                .reduce((sum, t) => sum + Number(t.amount), 0)
            )}
          </p>
        </div>

      </div>

      {/* TRANSACTIONS */}
      <div className="px-4 mt-2">

        <p className="text-sm font-semibold mb-2">
          {t("wallet.transactions")}
        </p>

        <div className="bg-white rounded-xl shadow divide-y">

          {txs.length === 0 && (
            <div className="p-6 text-center text-gray-400 text-sm">
              {t("wallet.no_transactions")}
            </div>
          )}

          {txs.map((tItem) => (
            <div
              key={tItem.id}
              className="p-4 flex justify-between items-center"
            >

              <div>
                <p className="text-sm font-medium capitalize">
                  {t(`wallet.ref.${tItem.reference_type}`)}
                </p>

                <p className="text-xs text-gray-400">
                  {formatTime(tItem.created_at)}
                </p>
              </div>

              <p
                className={`text-sm font-semibold ${
                  tItem.type === "credit"
                    ? "text-green-600"
                    : "text-red-500"
                }`}
              >
                {tItem.type === "credit" ? "+" : "-"}π
                {formatPi(tItem.amount)}
              </p>

            </div>
          ))}
        </div>
      </div>

    </main>
  );
}

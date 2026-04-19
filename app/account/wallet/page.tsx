"use client";

export const dynamic = "force-dynamic";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState, useRef } from "react";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

/* ================= TYPES ================= */

type Tx = {
  id: string;
  type: "credit" | "debit";
  amount: number;
  reference_type: string;
  created_at: string;
};

/* ================= UTILS ================= */

function formatPi(n: number) {
  return Number(n).toFixed(2);
}

function formatTime(date: string) {
  return new Date(date).toLocaleString();
}

/* ================= PAGE ================= */

export default function WalletPage() {
  const [balance, setBalance] = useState<number>(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 🔥 deposit state
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);

  const { loading: authLoading } = useAuth();
  const hasLoaded = useRef(false);

  /* ================= LOAD ================= */

  useEffect(() => {
    if (authLoading || hasLoaded.current) return;

    hasLoaded.current = true;
    load();
  }, [authLoading]);

  async function load() {
    try {
      const [w, t] = await Promise.all([
        apiAuthFetch("/api/wallet", { cache: "no-store" }),
        apiAuthFetch("/api/wallet/transactions", { cache: "no-store" }),
      ]);

      if (w.ok) {
        const wJson = await w.json();
        setBalance(Number(wJson.balance) || 0);
      }

      if (t.ok) {
        const tJson = await t.json();
        setTxs(Array.isArray(tJson) ? tJson : []);
      }
    } catch (err) {
      console.error("🔥 wallet load error", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    await load();
  }

  /* ================= DEPOSIT ================= */

  async function handleDeposit() {
    const amount = Number(depositAmount);

    if (!amount || amount <= 0) {
      alert("Invalid amount");
      return;
    }

    try {
      setDepositing(true);

      const Pi = (window as any).Pi;

      if (!Pi) {
        alert("Pi SDK not available");
        return;
      }

      await Pi.createPayment(
        {
          amount,
          memo: "Deposit to wallet",
          metadata: { type: "deposit" },
        },
        {
          onReadyForServerApproval: async (paymentId: string) => {
            const res = await apiAuthFetch("/api/pi/deposit/complete", {
              method: "POST",
              body: JSON.stringify({ paymentId }),
            });

            if (!res.ok) {
              alert("Deposit failed");
              return;
            }

            setDepositOpen(false);
            setDepositAmount("");

            await load();
          },

          onCancel: () => {
            console.log("User cancelled payment");
          },

          onError: (err: any) => {
            console.error("Pi payment error", err);
            alert("Payment error");
          },
        }
      );
    } catch (err) {
      console.error(err);
    } finally {
      setDepositing(false);
    }
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
          <p className="text-sm opacity-80">Your Balance</p>

          <button
            onClick={refresh}
            className="text-xs bg-white/20 px-3 py-1 rounded-full"
          >
            {refreshing ? "..." : "Refresh"}
          </button>
        </div>

        <h1 className="text-3xl font-bold mt-2">
          π {formatPi(balance)}
        </h1>

        {/* ACTIONS */}
        <div className="flex gap-3 mt-5">

          <button
            onClick={() => setDepositOpen(true)}
            className="flex-1 bg-white text-orange-600 py-2 rounded-xl text-sm font-semibold"
          >
            Deposit
          </button>

          <button className="flex-1 bg-white text-orange-600 py-2 rounded-xl text-sm font-semibold">
            Withdraw
          </button>

          <button className="flex-1 bg-white text-orange-600 py-2 rounded-xl text-sm font-semibold">
            Pay
          </button>

        </div>
      </div>

      {/* QUICK INFO */}
      <div className="p-4 grid grid-cols-2 gap-3">

        <div className="bg-white p-4 rounded-xl shadow">
          <p className="text-xs text-gray-400">Total In</p>
          <p className="text-green-600 font-semibold">
            +π {formatPi(
              txs
                .filter((t) => t.type === "credit")
                .reduce((a, b) => a + Number(b.amount), 0)
            )}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow">
          <p className="text-xs text-gray-400">Total Out</p>
          <p className="text-red-500 font-semibold">
            -π {formatPi(
              txs
                .filter((t) => t.type === "debit")
                .reduce((a, b) => a + Number(b.amount), 0)
            )}
          </p>
        </div>

      </div>

      {/* TRANSACTIONS */}
      <div className="px-4 mt-2">

        <p className="text-sm font-semibold mb-2">
          Transactions
        </p>

        <div className="bg-white rounded-xl shadow divide-y">

          {txs.length === 0 && (
            <div className="p-6 text-center text-gray-400 text-sm">
              No transactions yet
            </div>
          )}

          {txs.map((t) => (
            <div key={t.id} className="p-4 flex justify-between items-center">

              <div>
                <p className="text-sm font-medium capitalize">
                  {t.reference_type}
                </p>

                <p className="text-xs text-gray-400">
                  {formatTime(t.created_at)}
                </p>
              </div>

              <p
                className={`text-sm font-semibold ${
                  t.type === "credit"
                    ? "text-green-600"
                    : "text-red-500"
                }`}
              >
                {t.type === "credit" ? "+" : "-"}π
                {formatPi(t.amount)}
              </p>

            </div>
          ))}
        </div>
      </div>

      {/* DEPOSIT MODAL */}
      {depositOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end">

          <div className="bg-white w-full p-5 rounded-t-2xl space-y-4">

            <h2 className="text-lg font-semibold">
              Deposit Pi
            </h2>

            <input
              type="number"
              placeholder="Enter amount (π)"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="w-full border p-3 rounded-lg text-lg"
            />

            <div className="flex gap-2">
              {[1, 5, 10, 20].map((v) => (
                <button
                  key={v}
                  onClick={() => setDepositAmount(String(v))}
                  className="flex-1 bg-gray-100 py-2 rounded-lg text-sm"
                >
                  {v}π
                </button>
              ))}
            </div>

            <button
              disabled={depositing}
              onClick={handleDeposit}
              className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold"
            >
              {depositing ? "Processing..." : "Confirm Deposit"}
            </button>

            <button
              onClick={() => setDepositOpen(false)}
              className="w-full text-gray-500 text-sm"
            >
              Cancel
            </button>

          </div>
        </div>
      )}

    </main>
  );
}

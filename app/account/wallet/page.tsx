"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

type Tx = {
  id: string;
  type: string;
  amount: number;
  reference_type: string;
  created_at: string;
};

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [w, t] = await Promise.all([
        apiAuthFetch("/api/wallet"),
        apiAuthFetch("/api/wallet/transactions"),
      ]);

      const wJson = await w.json();
      const tJson = await t.json();

      setBalance(wJson.balance || 0);
      setTxs(tJson || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p className="p-4">Loading...</p>;

  return (
    <main className="p-4 space-y-4">

      {/* BALANCE */}
      <div className="bg-white p-4 rounded-xl shadow">
        <p className="text-sm text-gray-500">Balance</p>
        <p className="text-2xl font-bold">
          π {balance}
        </p>
      </div>

      {/* TRANSACTIONS */}
      <div className="bg-white rounded-xl divide-y">
        {txs.map((t) => (
          <div key={t.id} className="p-3 flex justify-between">
            <div>
              <p className="text-sm">{t.reference_type}</p>
              <p className="text-xs text-gray-400">
                {new Date(t.created_at).toLocaleString()}
              </p>
            </div>

            <p
              className={
                t.type === "credit"
                  ? "text-green-600"
                  : "text-red-500"
              }
            >
              {t.type === "credit" ? "+" : "-"}π{t.amount}
            </p>
          </div>
        ))}
      </div>

    </main>
  );
}

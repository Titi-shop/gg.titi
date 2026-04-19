"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useAuth } from "@/context/AuthContext";

/* ================= TYPES ================= */

type ReturnStatus =
  | "pending"
  | "approved"
  | "shipping_back"
  | "received"
  | "refund_pending"
  | "refunded"
  | "rejected";

type ReturnItem = {
  id: string;
  return_number: string;
  status: ReturnStatus;
  created_at: string;

  product_name: string;
  thumbnail: string;
  quantity: number;
};

/* ================= PAGE ================= */

export default function SellerReturnsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [items, setItems] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<ReturnStatus | "all">("all");

  /* ================= LOAD ================= */

  useEffect(() => {
    if (authLoading || !user) return;
    load();
  }, [authLoading, user, tab]);

  async function load() {
    try {
      console.log("🚀 [RETURN DASHBOARD] LOAD:", tab);

      const url =
        tab === "all"
          ? "/api/seller/returns"
          : `/api/seller/returns?status=${tab}`;

      const res = await apiAuthFetch(url);

      if (!res.ok) {
        console.error("❌ LOAD FAIL:", res.status);
        return;
      }

      const json = await res.json();
      const list = json.items ?? [];

      console.log("📦 DATA:", list);

      setItems(list);

    } catch (err) {
      console.error("💥 LOAD ERROR:", err);
    } finally {
      setLoading(false);
    }
  }

  /* ================= STATUS ================= */

  function getStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Waiting approval";
    case "approved":
      return "Approved";
    case "shipping_back":
      return "Buyer returning";
    case "received":
      return "Received";
    case "refund_pending":
      return "Waiting refund confirm";
    case "refunded":
      return "Refunded";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

  /* ================= TABS ================= */

  const tabs: (ReturnStatus | "all")[] = [
    "all",
    "pending",
    "approved",
    "shipping_back",
    "received",
    "refunded",
    "rejected",
  ];

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-100 pb-20">

      {/* HEADER */}
      <div className="bg-white px-4 py-3 border-b sticky top-0 z-10">
        <h1 className="font-semibold text-lg">
          🔄 Return Orders
        </h1>
      </div>

      {/* TABS */}
      <div className="bg-white overflow-x-auto border-b">
        <div className="flex gap-3 px-3 py-2 min-w-max">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 text-sm rounded-full border ${
                tab === t
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* LIST */}
      <div className="p-3 space-y-3">

        {loading && (
          <p className="text-center text-gray-400">
            Loading...
          </p>
        )}

        {!loading && items.length === 0 && (
          <div className="bg-white p-6 text-center text-gray-500 rounded-xl">
            No return orders
          </div>
        )}

        {items.map((item) => (
          <div
            key={item.id}
            onClick={() =>
              router.push(`/seller/returns/${item.id}`)
            }
            className="bg-white rounded-xl p-3 flex gap-3 shadow-sm hover:shadow-md transition cursor-pointer"
          >
            {/* IMAGE */}
            <img
              src={item.thumbnail || "/placeholder.png"}
              className="w-20 h-20 object-cover rounded"
              onError={(e) => {
                e.currentTarget.src = "/placeholder.png";
              }}
            />

            {/* INFO */}
            <div className="flex-1 flex flex-col justify-between">

              <div>
                <p className="text-sm font-medium line-clamp-2">
                  {item.product_name}
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  Qty: {item.quantity}
                </p>
              </div>

              <div className="flex justify-between items-end mt-2">

                <span
                  className={`text-xs px-2 py-1 rounded-full ${getColor(
                    item.status
                  )}`}
                >
                  {item.status}
                </span>

                <span className="text-[10px] text-gray-400">
                  {new Date(item.created_at).toLocaleString()}
                </span>

              </div>

            </div>
          </div>
        ))}

      </div>
    </main>
  );
}

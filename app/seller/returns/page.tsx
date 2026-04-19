"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useAuth } from "@/context/AuthContext";

/* ================= TYPES ================= */

type ReturnRecord = {
  id: string;
  return_number: string;
  order_id: string;
  status: string;
  created_at: string;

  /* NEW (API cần trả) */
  product_name?: string;
  thumbnail?: string;
  quantity?: number;
};

/* ================= PAGE ================= */

export default function SellerReturnsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [data, setData] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);

  /* ================= LOAD ================= */

  useEffect(() => {
    if (authLoading || !user) return;
    load();
  }, [authLoading, user]);

  async function load() {
    try {
      console.log("🚀 [SELLER RETURNS] LOAD");

      const res = await apiAuthFetch("/api/seller/returns");

      if (!res.ok) {
        console.error("❌ [SELLER RETURNS] API FAIL:", res.status);
        return;
      }

      const json = await res.json();

      const list = Array.isArray(json)
        ? json
        : json.items ?? [];

      console.log("📦 [SELLER RETURNS] DATA:", list);

      setData(list);

    } catch (err) {
      console.error("💥 [SELLER RETURNS] ERROR:", err);
    } finally {
      setLoading(false);
    }
  }

  /* ================= STATUS ================= */

  function getColor(status: string) {
    switch (status) {
      case "pending":
        return "text-yellow-600";
      case "approved":
        return "text-blue-600";
      case "shipping_back":
        return "text-indigo-600";
      case "received":
        return "text-purple-600";
      case "refunded":
        return "text-green-600";
      case "rejected":
        return "text-red-600";
      default:
        return "text-gray-500";
    }
  }

  function getStatusText(status: string) {
    switch (status) {
      case "pending":
        return "Pending";
      case "approved":
        return "Approved";
      case "shipping_back":
        return "Returning";
      case "received":
        return "Received";
      case "refunded":
        return "Refunded";
      case "rejected":
        return "Rejected";
      default:
        return status;
    }
  }

  /* ================= UI ================= */

  if (loading) {
    return <p className="p-4">Loading...</p>;
  }

  return (
    <main className="p-4 max-w-xl mx-auto space-y-4 bg-gray-100 min-h-screen">

      <h1 className="text-lg font-bold">
        🔄 Seller Returns
      </h1>

      {data.length === 0 && (
        <div className="text-center text-gray-500 bg-white p-6 rounded-xl">
          No returns
        </div>
      )}

      {data.map((r) => (
        <div
          key={r.id}
          onClick={() => router.push(`/seller/returns/${r.id}`)}
          className="bg-white p-4 rounded-xl shadow-sm cursor-pointer hover:shadow-md transition flex gap-3"
        >
          {/* IMAGE */}
          <div className="w-20 h-20 bg-gray-100 rounded overflow-hidden flex-shrink-0">
            <img
              src={r.thumbnail || "/placeholder.png"}
              alt="product"
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error("❌ IMAGE FAIL:", r.thumbnail);
                e.currentTarget.src = "/placeholder.png";
              }}
            />
          </div>

          {/* INFO */}
          <div className="flex-1 space-y-1">

            <div className="flex justify-between">
              <p className="text-sm font-semibold line-clamp-1">
                {r.product_name || "Product"}
              </p>

              <span className={`text-xs font-medium ${getColor(r.status)}`}>
                {getStatusText(r.status)}
              </span>
            </div>

            <p className="text-xs text-gray-500">
              Qty: {r.quantity ?? 1}
            </p>

            <p className="text-[11px] text-gray-400">
              #{r.return_number}
            </p>

            <p className="text-[10px] text-gray-400">
              {new Date(r.created_at).toLocaleString()}
            </p>

          </div>

        </div>
      ))}

    </main>
  );
}

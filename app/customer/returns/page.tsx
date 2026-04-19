"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

/* ================= TYPES ================= */

type ReturnRecord = {
  id: string;
  return_number?: string;
  order_id: string;
  status: string;
  refund_amount?: string;
  created_at: string;
  return_tracking_code?: string | null;
  refunded_at?: string | null;

  thumbnail?: string; // ✅ quan trọng
};

/* ================= CONST ================= */

const BASE_STORAGE =
  process.env.NEXT_PUBLIC_SUPABASE_URL +
  "/storage/v1/object/public/";

/* ================= PAGE ================= */

export default function ReturnsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);

  /* ================= LOAD ================= */

  useEffect(() => {
    if (authLoading || !user) return;

    async function load() {
      try {
        console.log("🚀 [RETURNS] LOAD");

        const res = await apiAuthFetch("/api/returns");

        if (!res.ok) {
          console.error("❌ [RETURNS] API ERROR:", res.status);
          return;
        }

        const data = await res.json();

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.items)
          ? data.items
          : [];

        console.log("📦 [RETURNS] COUNT:", list.length);

        setReturns(list);
      } catch (err) {
        console.error("💥 [RETURNS] LOAD ERROR");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [authLoading, user]);

  /* ================= HELPERS ================= */

  function getImage(src?: string) {
    if (!src) return "/placeholder.png";

    if (src.startsWith("http")) return src;

    return BASE_STORAGE + "products/" + src;
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-700";

      case "approved":
        return "bg-blue-100 text-blue-700";

      case "shipping_back":
        return "bg-indigo-100 text-indigo-700";

      case "received":
        return "bg-purple-100 text-purple-700";

      case "refunded":
        return "bg-green-200 text-green-800";

      case "rejected":
        return "bg-red-100 text-red-700";

      default:
        return "bg-gray-100 text-gray-600";
    }
  }

  function getStatusText(status: string) {
    switch (status) {
      case "pending":
        return "Pending";

      case "approved":
        return "Approved";

      case "shipping_back":
        return "Shipping Back";

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

  function renderTimeline(status: string) {
    const steps = [
      "pending",
      "approved",
      "shipping_back",
      "received",
      "refunded",
    ];

    return (
      <div className="flex items-center gap-1 text-[10px]">
        {steps.map((s, i) => {
          const active = steps.indexOf(status) >= i;

          return (
            <div key={s} className="flex items-center gap-1">
              <span
                className={
                  active ? "text-green-600" : "text-gray-300"
                }
              >
                ●
              </span>

              {i !== steps.length - 1 && (
                <span className="text-gray-300">—</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading...
      </div>
    );
  }

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-xl mx-auto p-4 space-y-4">

        <h1 className="text-lg font-semibold">
          {t.my_returns ?? "My Returns"}
        </h1>

        {returns.length === 0 && (
          <div className="bg-white p-6 rounded-xl shadow-sm text-center text-gray-500">
            No return requests
          </div>
        )}

        {returns.map((r) => {
          if (!r?.id) return null;

          return (
            <div
              key={r.id}
              onClick={() =>
                router.push(`/customer/returns/${r.id}`)
              }
              className="bg-white rounded-xl shadow-sm p-3 cursor-pointer active:scale-[0.98] transition"
            >
              <div className="flex gap-3">

                {/* IMAGE */}
                <img
                  src={getImage(r.thumbnail)}
                  onError={(e) => {
                    e.currentTarget.src = "/placeholder.png";
                  }}
                  className="w-16 h-16 rounded-lg object-cover border"
                />

                {/* CONTENT */}
                <div className="flex-1 space-y-2">

                  {/* HEADER */}
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm font-semibold">
                        #{r.return_number ?? r.id.slice(0, 8)}
                      </p>

                      <p className="text-[11px] text-gray-400">
                        Order: {r.order_id?.slice(0, 8)}
                      </p>
                    </div>

                    <span
                      className={`px-2 py-1 text-[10px] rounded-full ${getStatusColor(
                        r.status
                      )}`}
                    >
                      {getStatusText(r.status)}
                    </span>
                  </div>

                  {/* TIMELINE */}
                  {renderTimeline(r.status)}

                  {/* EXTRA INFO */}
                  {r.return_tracking_code && (
                    <p className="text-[11px] text-blue-600">
                      Tracking: {r.return_tracking_code}
                    </p>
                  )}

                  {r.refunded_at && (
                    <p className="text-[11px] text-green-600">
                      Refunded:{" "}
                      {new Date(
                        r.refunded_at
                      ).toLocaleString()}
                    </p>
                  )}

                </div>
              </div>
            </div>
          );
        })}

      </div>
    </main>
  );
}


"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

/* ================= TYPES ================= */

type ReturnStatus =
  | "all"
  | "pending"
  | "approved"
  | "shipping_back"
  | "received"
  | "refund_pending"
  | "refunded"
  | "rejected";

type ReturnRecord = {
  id: string;
  return_number?: string;
  order_id: string;
  status: ReturnStatus;
  refund_amount?: string;
  created_at: string | null;
  return_tracking_code?: string | null;
  refunded_at?: string | null;
  thumbnail?: string;
};

/* ================= CONST ================= */

const BASE_STORAGE =
  process.env.NEXT_PUBLIC_SUPABASE_URL +
  "/storage/v1/object/public/";

const TABS: ReturnStatus[] = [
  "all",
  "pending",
  "approved",
  "shipping_back",
  "received",
  "refund_pending",
  "refunded",
  "rejected",
];

/* ================= PAGE ================= */

export default function ReturnsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ReturnStatus>("all");

  /* ================= LOAD ================= */

  useEffect(() => {
    if (authLoading || !user) return;

    async function load() {
      try {
        const res = await apiAuthFetch("/api/returns");

        if (!res.ok) return;

        const data = await res.json();

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.items)
          ? data.items
          : [];

        setReturns(list);
      } catch (err) {
        console.error("💥 LOAD ERROR", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [authLoading, user]);

  /* ================= FILTER ================= */

  const filtered =
    tab === "all"
      ? returns
      : returns.filter((r) => r.status === tab);

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
      case "refund_pending":
        return "bg-orange-100 text-orange-700";
      case "refunded":
        return "bg-green-200 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  }

  function getStatusText(status: string) {
    return t[status] ?? status;
  }

  /* ================= UI ================= */

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        {t.loading}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-16">

      {/* TITLE */}
      <div className="max-w-xl mx-auto p-4">
        <h1 className="text-lg font-semibold">
          {t.my_returns}
        </h1>
      </div>

      {/* FILTER TABS (CAM NHƯ HEADER) */}
      <div className="sticky top-0 bg-orange-500 px-3 py-2 overflow-x-auto flex gap-2">

        {TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${
              tab === s
                ? "bg-white text-orange-600 font-semibold"
                : "bg-white/20 text-white"
            }`}
          >
            {t[s] ?? s}
          </button>
        ))}
      </div>

      {/* LIST */}
      <div className="max-w-xl mx-auto p-4 space-y-4">

        {filtered.length === 0 && (
          <div className="bg-white p-6 rounded-xl shadow-sm text-center text-gray-500">
            {t.no_returns}
          </div>
        )}

        {filtered.map((r) => {
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

                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm font-semibold">
                        #{r.return_number ?? r.id.slice(0, 8)}
                      </p>

                      <p className="text-[11px] text-gray-400">
                        {t.order}: {r.order_id?.slice(0, 8)}
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

                  {/* EXTRA */}
                  {r.return_tracking_code && (
                    <p className="text-[11px] text-blue-600">
                      {t.tracking}: {r.return_tracking_code}
                    </p>
                  )}

                  {r.refunded_at && (
                    <p className="text-[11px] text-green-600">
                      {t.refunded}:{" "}
                      {new Date(r.refunded_at).toLocaleString()}
                    </p>
                  )}

                  {r.created_at && (
                    <p className="text-[10px] text-gray-400">
                      {new Date(r.created_at).toLocaleString()}
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

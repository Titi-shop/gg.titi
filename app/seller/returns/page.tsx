"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

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
  created_at: string | null;

  product_name: string;
  thumbnail: string;
  quantity: number;
};

type ReturnDetail = {
  id: string;
  status: ReturnStatus;
  reason: string;
  evidence_images?: string[];
  return_tracking_code?: string;
};

/* ================= PAGE ================= */

export default function SellerReturnsPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();

  const [items, setItems] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<ReturnStatus | "all">("all");

  /* ===== bottom sheet ===== */
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReturnDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [acting, setActing] = useState(false);

  /* ================= LOAD LIST ================= */

  useEffect(() => {
    if (authLoading || !user) return;
    load();
  }, [authLoading, user, tab]);

  async function load() {
    try {
      const url =
        tab === "all"
          ? "/api/seller/returns"
          : `/api/seller/returns?status=${tab}`;

      const res = await apiAuthFetch(url);
      if (!res.ok) return;

      const json = await res.json();
      setItems(json.items ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  /* ================= LOAD DETAIL ================= */

  async function openDetail(id: string) {
    try {
      setOpenId(id);
      setLoadingDetail(true);

      const res = await apiAuthFetch(`/api/seller/returns/${id}`);
      if (!res.ok) return;

      const json = await res.json();
      setDetail(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeSheet() {
    setOpenId(null);
    setDetail(null);
  }

  /* ================= ACTION ================= */

  async function action(type: string) {
    if (!openId || acting) return;

    try {
      setActing(true);

      const res = await apiAuthFetch(`/api/seller/returns/${openId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: type }),
      });

      if (!res.ok) {
        alert(t.action_failed || "Action failed");
        return;
      }

      await openDetail(openId);
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setActing(false);
    }
  }

  /* ================= STATUS ================= */

  function getStatusLabel(status: ReturnStatus) {
    switch (status) {
      case "pending":
        return t.pending;
      case "approved":
        return t.approved;
      case "shipping_back":
        return t.shipping_back;
      case "received":
        return t.received;
      case "refund_pending":
        return t.refund_pending;
      case "refunded":
        return t.refunded;
      case "rejected":
        return t.rejected;
      default:
        return status;
    }
  }

  function getColor(status: ReturnStatus) {
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
        return "bg-green-100 text-green-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  }

  /* ================= TABS ================= */

  const tabs: (ReturnStatus | "all")[] = [
    "all",
    "pending",
    "approved",
    "shipping_back",
    "received",
    "refund_pending",
    "refunded",
    "rejected",
  ];

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* HEADER */}
      <div className="bg-primary text-white px-4 py-4 font-semibold shadow">
        {t.return_orders}
      </div>

      {/* TABS */}
      <div className="bg-white overflow-x-auto border-b">
        <div className="flex gap-2 px-3 py-2 min-w-max">
          {tabs.map((tKey) => (
            <button
              key={tKey}
              onClick={() => setTab(tKey)}
              className={`px-3 py-1 text-sm rounded-full ${
                tab === tKey
                 ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {t[tKey] ?? tKey}
            </button>
          ))}
        </div>
      </div>

      {/* LIST */}
      <div className="p-3 space-y-3">
        {loading && <p className="text-center">Loading...</p>}

        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => openDetail(item.id)}
            className="bg-white rounded-xl p-3 flex gap-3 shadow-sm"
          >
            <img
              src={item.thumbnail || "/placeholder.png"}
              className="w-20 h-20 rounded object-cover"
            />

            <div className="flex-1">
              <p className="text-sm font-medium">
                {item.product_name}
              </p>

              <p className="text-xs text-gray-500">
                Qty: {item.quantity}
              </p>

              <div className="flex justify-between mt-2">
                <span
                  className={`text-xs px-2 py-1 rounded ${getColor(
                    item.status
                  )}`}
                >
                  {getStatusLabel(item.status)}
                </span>

                <span className="text-xs text-gray-400">
                  {item.created_at &&
                    new Date(item.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ================= BOTTOM SHEET ================= */}

      {openId && (
        <div className="fixed inset-0 z-50">

          {/* overlay */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeSheet}
          />

          {/* sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 animate-slideUp max-h-[80vh] overflow-auto">

            {/* handle */}
            <div className="w-10 h-1 bg-gray-300 rounded mx-auto mb-3" />

            {loadingDetail && <p>Loading...</p>}

            {detail && (
              <>
                <p className="font-semibold text-lg">
                  {t.return_detail}
                </p>

                {/* STATUS */}
                <div className="mt-2">
                  <span
                    className={`px-2 py-1 text-xs rounded ${getColor(
                      detail.status
                    )}`}
                  >
                    {getStatusLabel(detail.status)}
                  </span>
                </div>

                {/* REASON */}
                <div className="mt-4">
                  <p className="text-sm font-semibold">
                    {t.reason}
                  </p>
                  <p className="text-sm text-gray-600">
                    {detail.reason}
                  </p>
                </div>

                {/* IMAGES */}
                <div className="flex gap-2 mt-3 overflow-x-auto">
                  {detail.evidence_images?.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      className="w-20 h-20 rounded object-cover"
                    />
                  ))}
                </div>

                {/* ACTIONS */}
                <div className="mt-5 space-y-2">

                  {detail.status === "pending" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => action("approve")}
                        className="flex-1 bg-green-500 text-white py-3 rounded"
                      >
                        {t.approve}
                      </button>

                      <button
                        onClick={() => action("reject")}
                        className="flex-1 bg-red-500 text-white py-3 rounded"
                      >
                        {t.reject}
                      </button>
                    </div>
                  )}

                  {detail.status === "shipping_back" && (
                    <button
                      onClick={() => action("received")}
                      className="w-full bg-primary text-white py-3 rounded"
                    >
                      {t.mark_received}
                    </button>
                  )}

                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* animation */}
      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slideUp {
          animation: slideUp 0.25s ease;
        }
      `}</style>

    </main>
  );
}

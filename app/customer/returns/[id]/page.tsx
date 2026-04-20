"use client";

export const dynamic = "force-dynamic";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* ================= TYPES ================= */

type TimelineItem = {
  label: string;
  time: string;
};

type ReturnItem = {
  product_name: string;
  thumbnail: string;
  quantity: number;
  unit_price: number;
};

type ReturnDetail = {
  id: string;
  return_number: string;
  status: string;
  reason: string;
  description?: string;
  evidence_images?: string[];
  timeline?: TimelineItem[];
  items: ReturnItem[];
  return_tracking_code?: string;
};

/* ================= PAGE ================= */

export default function SellerReturnDetailPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [data, setData] = useState<ReturnDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
const { user, loading: authLoading } = useAuth();
  const [preview, setPreview] = useState<string | null>(null);

  /* ================= LOAD ================= */

  useEffect(() => {
  if (authLoading) return;
  if (!user) return;
  if (!id) return;

  load();
}, [authLoading, user, id]);

  async function load() {
    try {
      const res = await apiAuthFetch(`/api/seller/returns/${id}`);
      if (!res.ok) return;

      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("[RETURN][LOAD]", err);
    } finally {
      setLoading(false);
    }
  }

  /* ================= ACTION ================= */

  async function markReceived() {
    if (!data || acting) return;

    try {
      setActing(true);

      const res = await apiAuthFetch(`/api/seller/returns/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "received" }),
      });

      if (!res.ok) {
        alert(t.action_failed);
        return;
      }

      await load();
    } finally {
      setActing(false);
    }
  }

  /* ================= HELPERS ================= */

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
        return t.waiting_refund;
      case "refunded":
        return t.refunded;
      case "rejected":
        return t.rejected;
      default:
        return status;
    }
  }

  const allImages: string[] = [
    ...(data?.items?.map((i) => i.thumbnail) ?? []),
    ...(data?.evidence_images ?? []),
  ].filter((i): i is string => typeof i === "string" && i.length > 5);

  /* ================= UI ================= */

  if (loading) {
    return <div className="p-4">{t.loading}</div>;
  }

  if (!data) {
    return <div className="p-4 text-red-500">{t.not_found}</div>;
  }

  return (
    <main className="min-h-screen bg-gray-100 pb-24 space-y-4">

      {/* HEADER */}
      <div className="bg-white p-4 border-b space-y-2">
        <p className="text-sm text-gray-500">
          #{data.return_number || data.id.slice(0, 8)}
        </p>

        <div className="flex justify-between items-center">
          <h1 className="font-semibold text-lg">
            {t.return_request}
          </h1>

          <span className={`px-3 py-1 text-xs rounded-full ${getStatusColor(data.status)}`}>
            {getStatusText(data.status)}
          </span>
        </div>

        {data.return_tracking_code && (
          <p className="text-xs text-blue-600">
            {t.tracking}: {data.return_tracking_code}
          </p>
        )}
      </div>

      {/* PRODUCT */}
      <div className="bg-white p-4 flex gap-3">
        {data.items.map((item, i) => (
          <div key={i} className="flex gap-3">
            <img
              src={item.thumbnail || "/placeholder.png"}
              className="w-20 h-20 object-cover rounded border"
            />

            <div>
              <p className="text-sm font-medium">
                {item.product_name}
              </p>

              <p className="text-xs text-gray-500">
                {t.quantity}: {item.quantity}
              </p>

              <p className="font-semibold mt-1">
                π{item.unit_price}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* REASON */}
      <div className="bg-white p-4">
        <p className="font-semibold mb-1">{t.reason}</p>
        <p className="text-gray-600 text-sm">{data.reason}</p>
      </div>

      {/* IMAGES */}
      <div className="bg-white p-4">
        <p className="font-semibold mb-2">
          {t.product_and_evidence_images}
        </p>

        <div className="grid grid-cols-3 gap-3">
          {allImages.map((src, i) => (
            <img
              key={i}
              src={src}
              onClick={() => setPreview(src)}
              className="w-full h-24 object-cover rounded-lg border cursor-pointer"
            />
          ))}
        </div>
      </div>

      {/* TIMELINE */}
      {data.timeline && data.timeline.length > 0 && (
        <div className="bg-white p-4">
          <p className="font-semibold mb-3">{t.timeline}</p>

          <div className="space-y-3">
            {data.timeline.map((tItem, i) => (
              <div key={i} className="flex gap-3">
                <div className="mt-1 w-2 h-2 bg-black rounded-full" />

                <div>
                  <p className="text-sm">{tItem.label}</p>
                  <p className="text-xs text-gray-400">
                    {tItem.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ACTION */}
      {data.status === "shipping_back" && (
        <div className="p-4">
          <button
            disabled={acting}
            onClick={markReceived}
            className="w-full bg-blue-500 text-white py-4 rounded-xl text-sm font-semibold"
          >
            {acting ? t.processing : t.mark_as_received}
          </button>
        </div>
      )}

      {/* PREVIEW IMAGE */}
      {preview && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onClick={() => setPreview(null)}
        >
          <img
            src={preview}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </main>
  );
}

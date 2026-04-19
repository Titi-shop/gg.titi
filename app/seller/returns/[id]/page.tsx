"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

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
};

/* ================= PAGE ================= */

export default function SellerReturnDetail() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<ReturnDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      console.log("🚀 LOAD RETURN DETAIL:", id);

      const res = await apiAuthFetch(`/api/seller/returns/${id}`);

      if (!res.ok) {
        console.error("❌ API ERROR:", res.status);
        return;
      }

      const json = await res.json();

      console.log("📦 RETURN DATA:", json);

      setData(json);
    } catch (err) {
      console.error("💥 LOAD ERROR", err);
    } finally {
      setLoading(false);
    }
  }

  async function action(type: string) {
    await apiAuthFetch(`/api/seller/returns/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: type }),
    });

    await load();
  }

  /* ================= STATUS ================= */

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

  /* ================= IMAGE LIST ================= */

  const allImages: string[] = [
    ...(data?.items?.map((i) => i.thumbnail) ?? []),
    ...(data?.evidence_images ?? []),
  ].filter((i) => typeof i === "string" && i.startsWith("http"));

  /* ================= UI ================= */

  if (loading) return <p className="p-4">Loading...</p>;

  if (!data) return <p className="p-4 text-red-500">Not found</p>;

  return (
    <main className="min-h-screen bg-gray-100 pb-20 space-y-4">

      {/* HEADER */}
      <div className="bg-white p-4 border-b space-y-2">
        <p className="text-sm text-gray-500">
          Return #{data.return_number || data.id.slice(0, 8)}
        </p>

        <div className="flex justify-between items-center">
          <h1 className="font-semibold text-lg">
            Return Request
          </h1>

          <span className={`px-3 py-1 text-xs rounded-full ${getStatusColor(data.status)}`}>
            {data.status}
          </span>
        </div>
      </div>

      {/* PRODUCTS */}
      <div className="bg-white divide-y">
        {data.items.map((item, i) => (
          <div key={i} className="flex gap-3 p-4">

            <img
              src={item.thumbnail || "/placeholder.png"}
              onError={(e) => (e.currentTarget.src = "/placeholder.png")}
              className="w-20 h-20 object-cover rounded border"
            />

            <div className="flex-1">
              <p className="text-sm font-medium line-clamp-2">
                {item.product_name}
              </p>

              <p className="text-xs text-gray-500 mt-1">
                Qty: {item.quantity}
              </p>

              <p className="text-sm font-semibold mt-2">
                π{item.unit_price}
              </p>
            </div>

          </div>
        ))}
      </div>

      {/* REASON */}
      <div className="bg-white p-4 space-y-2">
        <p className="text-sm font-semibold">Reason</p>
        <p className="text-sm text-gray-600">{data.reason}</p>

        {data.description && (
          <p className="text-xs text-gray-500">
            {data.description}
          </p>
        )}
      </div>

      {/* ================= IMAGES ================= */}

      <div className="bg-white p-4">
        <p className="text-sm font-semibold mb-2">
          Product & Evidence Images
        </p>

        {allImages.length === 0 ? (
          <p className="text-xs text-gray-400">
            No images
          </p>
        ) : (
          <div className="flex gap-2 overflow-x-auto">
            {allImages.map((src, i) => (
              <img
                key={i}
                src={src}
                onClick={() => setPreviewIndex(i)}
                onError={(e) => (e.currentTarget.src = "/placeholder.png")}
                className="w-24 h-24 object-cover rounded border cursor-pointer"
              />
            ))}
          </div>
        )}
      </div>

      {/* ================= TIMELINE ================= */}

      {data.timeline && (
        <div className="bg-white p-4 space-y-3">
          <p className="text-sm font-semibold">Timeline</p>

          {data.timeline.map((t, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <div className="w-2 h-2 mt-2 rounded-full bg-black" />
              <div>
                <p className="font-medium">{t.label}</p>
                <p className="text-xs text-gray-400">
                  {new Date(t.time).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================= PREVIEW ================= */}

      {previewIndex !== null && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">

          {/* HEADER */}
          <div className="flex justify-between p-3 text-white">
            <button onClick={() => setPreviewIndex(null)}>←</button>
            <span>{previewIndex + 1}/{allImages.length}</span>
            <span />
          </div>

          {/* IMAGE */}
          <div className="flex-1 flex items-center justify-center relative">

            <img
              src={allImages[previewIndex]}
              className="max-h-full max-w-full object-contain"
            />

            {previewIndex > 0 && (
              <button
                onClick={() => setPreviewIndex(previewIndex - 1)}
                className="absolute left-2 text-white text-2xl"
              >
                ‹
              </button>
            )}

            {previewIndex < allImages.length - 1 && (
              <button
                onClick={() => setPreviewIndex(previewIndex + 1)}
                className="absolute right-2 text-white text-2xl"
              >
                ›
              </button>
            )}
          </div>
        </div>
      )}

      {/* ACTIONS */}
      <div className="p-4 space-y-2">

        {data.status === "pending" && (
          <div className="flex gap-2">
            <button
              onClick={() => action("approve")}
              className="flex-1 bg-green-500 text-white py-3 rounded-lg"
            >
              Approve
            </button>

            <button
              onClick={() => action("reject")}
              className="flex-1 bg-red-500 text-white py-3 rounded-lg"
            >
              Reject
            </button>
          </div>
        )}

        {data.status === "shipping_back" && (
          <button
            onClick={() => action("received")}
            className="w-full bg-blue-500 text-white py-3 rounded-lg"
          >
            Mark as Received
          </button>
        )}

      </div>

    </main>
  );
}

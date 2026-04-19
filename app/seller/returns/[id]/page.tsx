
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

/* ================= TYPES ================= */

type TimelineItem = {
  label: string;
  time: string | null;
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

export default function SellerReturnDetail() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<ReturnDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  /* ================= ZOOM STATE ================= */

  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState({ x: 0, y: 0 });

  const [initialDistance, setInitialDistance] = useState(0);
  const [initialScale, setInitialScale] = useState(1);

  const [swipeDownStart, setSwipeDownStart] = useState<number | null>(null);

  /* ================= LOAD ================= */

  useEffect(() => {
    load();
    const i = setInterval(load, 10000);
    return () => clearInterval(i);
  }, []);

  async function load() {
    try {
      const res = await apiAuthFetch(`/api/seller/returns/${id}`);
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  /* ================= ACTION ================= */

  async function action(type: string) {
    if (acting) return;

    try {
      setActing(true);

      const res = await apiAuthFetch(`/api/seller/returns/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: type }),
      });

      if (!res.ok) {
        alert("Action failed");
        return;
      }

      await load();
    } finally {
      setActing(false);
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

  /* ================= IMAGES ================= */

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

        <div className="flex justify-between">
          <h1 className="font-semibold text-lg">Return Request</h1>
          <span className={`px-3 py-1 text-xs rounded-full ${getStatusColor(data.status)}`}>
            {getStatusLabel(data.status)}
          </span>
        </div>

        {data.return_tracking_code && (
          <p className="text-xs text-blue-600">
            Tracking: {data.return_tracking_code}
          </p>
        )}
      </div>

      {/* PRODUCTS */}
      <div className="bg-white divide-y">
        {data.items.map((item, i) => (
          <div key={i} className="flex gap-3 p-4">
            <img
              src={item.thumbnail}
              className="w-20 h-20 object-cover rounded border"
            />
            <div>
              <p>{item.product_name}</p>
              <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
              <p className="font-semibold">π{item.unit_price}</p>
            </div>
          </div>
        ))}
      </div>

      {/* IMAGES */}
      <div className="bg-white p-4">
        <p className="text-sm font-semibold mb-2">Images</p>

        <div className="flex gap-2 overflow-x-auto">
          {allImages.map((src, i) => (
            <img
              key={i}
              src={src}
              onClick={() => {
                setZoomImage(src);
                setScale(1);
                setPosition({ x: 0, y: 0 });
              }}
              className="w-24 h-24 object-cover rounded cursor-pointer"
            />
          ))}
        </div>
      </div>

      {/* ACTION */}
      {data.status === "shipping_back" && (
        <div className="p-4">
          <button
            disabled={acting}
            onClick={() => action("received")}
            className="w-full bg-blue-500 text-white py-3 rounded-lg"
          >
            Mark as Received
          </button>
        </div>
      )}

      {/* ================= ZOOM VIEW ================= */}

      {zoomImage && (
        <div
          className="fixed inset-0 bg-black/95 z-[999] flex items-center justify-center"
          onClick={() => setZoomImage(null)}
        >
          <img
            src={zoomImage}
            onClick={(e) => e.stopPropagation()}

            /* DOUBLE TAP */
            onTouchEnd={(e) => {
              const now = Date.now();
              if (!(window as any).__tap) (window as any).__tap = 0;

              if (now - (window as any).__tap < 300) {
                setScale((s) => (s === 1 ? 2 : 1));
                setPosition({ x: 0, y: 0 });
              }

              (window as any).__tap = now;
            }}

            /* TOUCH START */
            onTouchStart={(e) => {
              if (e.touches.length === 2) {
                const dx =
                  e.touches[0].clientX - e.touches[1].clientX;
                const dy =
                  e.touches[0].clientY - e.touches[1].clientY;

                setInitialDistance(Math.sqrt(dx * dx + dy * dy));
                setInitialScale(scale);
              }

              if (e.touches.length === 1) {
                const t = e.touches[0];

                setDragging(true);
                setStart({
                  x: t.clientX - position.x,
                  y: t.clientY - position.y,
                });

                setSwipeDownStart(t.clientY);
              }
            }}

            /* TOUCH MOVE */
            onTouchMove={(e) => {
              if (e.touches.length === 2) {
                const dx =
                  e.touches[0].clientX - e.touches[1].clientX;
                const dy =
                  e.touches[0].clientY - e.touches[1].clientY;

                const dist = Math.sqrt(dx * dx + dy * dy);

                let newScale =
                  initialScale * (dist / initialDistance);

                newScale = Math.max(1, Math.min(newScale, 6));
                setScale(newScale);
              }

              if (e.touches.length === 1 && dragging) {
                const t = e.touches[0];

                /* swipe down close */
                if (scale === 1 && swipeDownStart) {
                  if (t.clientY - swipeDownStart > 120) {
                    setZoomImage(null);
                    return;
                  }
                }

                if (scale > 1) {
                  setPosition({
                    x: t.clientX - start.x,
                    y: t.clientY - start.y,
                  });
                }
              }
            }}

            onTouchEnd={() => {
              setDragging(false);
              setSwipeDownStart(null);
            }}

            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            }}

            className="max-w-full max-h-full object-contain transition-transform"
          />
        </div>
      )}
    </main>
  );
}

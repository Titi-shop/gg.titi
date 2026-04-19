"use client";

export const dynamic = "force-dynamic";

import "swiper/css";
import "swiper/css/pagination";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";

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

  /* ===== ZOOM STATE ===== */
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState({ x: 0, y: 0 });
  const [initialDistance, setInitialDistance] = useState(0);
  const [initialScale, setInitialScale] = useState(1);

  /* ================= LOAD ================= */

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await apiAuthFetch(`/api/seller/returns/${id}`);
      if (!res.ok) return;

      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("LOAD ERROR", err);
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

  /* ================= IMAGE FIX ================= */

  const base =
    process.env.NEXT_PUBLIC_SUPABASE_URL +
    "/storage/v1/object/public/";

  const allImages: string[] = [
    ...(data?.items?.map((i) =>
      i.thumbnail?.startsWith("http")
        ? i.thumbnail
        : base + "products/" + i.thumbnail
    ) ?? []),

    ...(data?.evidence_images?.map((i) =>
      i?.startsWith("http")
        ? i
        : base + "returns/" + i
    ) ?? []),
  ].filter((i) => typeof i === "string" && i.trim() !== "");

  /* ================= UI ================= */

  if (loading) return <p className="p-4">Loading...</p>;
  if (!data) return <p className="p-4 text-red-500">Not found</p>;

  return (
    <main className="min-h-screen bg-gray-100 pb-20 space-y-4">

      {/* HEADER */}
      <div className="bg-white p-4 border-b">
        <p className="text-sm text-gray-500">
          Return #{data.return_number}
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
              onClick={() => setPreviewIndex(i)}
              className="w-20 h-20 object-cover rounded border cursor-pointer"
            />

            <div>
              <p className="text-sm font-medium">
                {item.product_name}
              </p>
              <p className="text-xs text-gray-500">
                Qty: {item.quantity}
              </p>
              <p className="font-semibold">
                π{item.unit_price}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* REASON */}
      <div className="bg-white p-4">
        <p className="font-semibold">Reason</p>
        <p className="text-gray-600">{data.reason}</p>
      </div>

      {/* IMAGE LIST */}
      <div className="bg-white p-4">
        <p className="font-semibold mb-2">
          Product & Evidence Images
        </p>

        <div className="flex gap-2 overflow-x-auto">
          {allImages.map((src, i) => (
            <img
              key={i}
              src={src}
              onClick={() => {
                setPreviewIndex(i);
                setScale(1);
                setPosition({ x: 0, y: 0 });
              }}
              className="w-24 h-24 object-cover rounded border cursor-pointer"
            />
          ))}
        </div>
      </div>

      {/* ================= FULL PREVIEW ================= */}

      {previewIndex !== null && (
        <div className="fixed inset-0 z-[999] bg-black flex flex-col h-screen">

          {/* HEADER */}
          <div className="flex justify-between items-center p-4 text-white">
            <button onClick={() => setPreviewIndex(null)}>✕</button>
            <span>{previewIndex + 1}/{allImages.length}</span>
            <div />
          </div>

          {/* SWIPER */}
          <Swiper
            modules={[Pagination]}
            pagination={{ clickable: true }}
            initialSlide={previewIndex}
            allowTouchMove={scale === 1}
            onSlideChange={(swiper) => {
              setPreviewIndex(swiper.activeIndex);
              setScale(1);
              setPosition({ x: 0, y: 0 });
            }}
            className="flex-1 h-full"
          >
            {allImages.map((src, i) => (
              <SwiperSlide key={i}>
                <div className="flex items-center justify-center h-full overflow-hidden">

                  <img
                    src={src}
                    draggable={false}

                    onTouchStart={(e) => {
                      if (e.touches.length === 2) {
                        const dx =
                          e.touches[0].clientX - e.touches[1].clientX;
                        const dy =
                          e.touches[0].clientY - e.touches[1].clientY;

                        const dist = Math.sqrt(dx * dx + dy * dy);

                        setInitialDistance(dist);
                        setInitialScale(scale);
                      }

                      if (e.touches.length === 1) {
                        const touch = e.touches[0];

                        setDragging(true);
                        setStart({
                          x: touch.clientX - position.x,
                          y: touch.clientY - position.y,
                        });
                      }
                    }}

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

                      if (e.touches.length === 1 && dragging && scale > 1) {
                        const touch = e.touches[0];

                        setPosition({
                          x: touch.clientX - start.x,
                          y: touch.clientY - start.y,
                        });
                      }
                    }}

                    onTouchEnd={() => setDragging(false)}

                    style={{
                      transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    }}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      )}

      {/* ACTION */}
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
      </div>

    </main>
  );
}

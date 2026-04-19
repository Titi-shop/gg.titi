"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

import "swiper/css";
import "swiper/css/pagination";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";

/* ================= TYPES ================= */

type ReturnStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "shipping_back"
  | "received"
  | "refund_pending"
  | "refunded"
  | "cancelled";

interface ReturnRecord {
  id: string;
  order_id: string;
  product_name: string;
  product_thumbnail: string | null;
  quantity: number;
  refund_amount: number;
  status: ReturnStatus;
  reason?: string;
  created_at: string;

  evidence_images?: string[];
  return_tracking_code?: string | null;
  shipping_provider?: string | null;
}

/* ================= CONST ================= */

const BASE_STORAGE =
  process.env.NEXT_PUBLIC_SUPABASE_URL +
  "/storage/v1/object/public/";

/* ================= PAGE ================= */

export default function ReturnDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();

  const returnId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const { user, loading: authLoading } = useAuth();

  const [data, setData] = useState<ReturnRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const [trackingCode, setTrackingCode] = useState("");
  const [shippingProvider, setShippingProvider] = useState("");
  const [sending, setSending] = useState(false);

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
    if (authLoading || !user || !returnId) return;
    loadReturn();
  }, [authLoading, user, returnId]);

  async function loadReturn() {
    try {
      const res = await apiAuthFetch(`/api/returns/${returnId}`);
      if (!res.ok) {
        setData(null);
        return;
      }

      const record: ReturnRecord = await res.json();
      setData(record);
    } catch (err) {
      console.error(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  /* ================= SHIP ================= */

  async function handleShip() {
    if (!trackingCode.trim()) {
      alert("Nhập mã vận đơn");
      return;
    }

    try {
      setSending(true);

      const res = await apiAuthFetch(`/api/returns/${returnId}/ship`, {
        method: "PATCH",
        body: JSON.stringify({
          tracking_code: trackingCode,
          shipping_provider: shippingProvider,
        }),
      });

      if (!res.ok) {
        alert("Gửi thất bại");
        return;
      }

      await loadReturn();
      setTrackingCode("");
      setShippingProvider("");
    } finally {
      setSending(false);
    }
  }

  /* ================= HELPERS ================= */

  function getImage(src?: string | null) {
    if (!src) return "/placeholder.png";
    if (src.startsWith("http")) return src;
    return BASE_STORAGE + src;
  }

  function getStatusLabel(status: ReturnStatus) {
    switch (status) {
      case "pending": return "Pending";
      case "approved": return "Approved";
      case "shipping_back": return "Shipping back";
      case "received": return "Received";
      case "refund_pending": return "Waiting refund confirm";
      case "refunded": return "Refunded";
      case "rejected": return "Rejected";
      default: return status;
    }
  }

  function getStatusColor(status: ReturnStatus) {
    switch (status) {
      case "pending": return "text-yellow-600";
      case "approved": return "text-blue-600";
      case "shipping_back": return "text-indigo-600";
      case "received": return "text-purple-600";
      case "refund_pending": return "text-orange-600";
      case "refunded": return "text-green-700";
      case "rejected": return "text-red-600";
      default: return "text-gray-500";
    }
  }

  const allImages: string[] = [
    data?.product_thumbnail ?? "",
    ...(data?.evidence_images ?? []),
  ].filter((i) => typeof i === "string" && i.length > 5);

  /* ================= UI ================= */

  if (loading) return <div className="p-4">Loading...</div>;
  if (!data) return <div className="p-4 text-red-500">Not found</div>;

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* HEADER */}
      <header className="bg-orange-500 text-white px-4 py-4">
        <div className="bg-orange-400 rounded-lg p-4">
          <p className="text-sm">Return Detail</p>
          <p className="text-xs">Order: #{data.order_id}</p>
        </div>
      </header>

      <section className="mt-6 px-4 space-y-4">

        {/* PRODUCT */}
        <div className="bg-white rounded-xl p-4 flex gap-3">
          <img
            src={getImage(data.product_thumbnail)}
            onClick={() => setPreviewIndex(0)}
            className="w-16 h-16 rounded border cursor-pointer"
          />
          <div>
            <p>{data.product_name}</p>
            <p className="text-xs text-gray-500">Qty: {data.quantity}</p>
          </div>
        </div>

        {/* STATUS */}
        <div className="bg-white p-4 flex justify-between rounded-xl">
          <span>Status</span>
          <span className={getStatusColor(data.status)}>
            {getStatusLabel(data.status)}
          </span>
        </div>

        {/* TRACKING */}
        {data.return_tracking_code && (
          <div className="bg-white p-4 text-blue-600 text-xs rounded-xl">
            Tracking: {data.return_tracking_code}
          </div>
        )}

        {/* REFUND NOTICE */}
        {data.status === "refund_pending" && (
          <div className="bg-yellow-50 text-yellow-700 p-3 rounded">
            Waiting buyer confirm refund in Pi Wallet
          </div>
        )}

        {/* SHIPPING */}
        {data.status === "approved" && (
          <div className="bg-white p-4 rounded-xl space-y-3">
            <input
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              placeholder="Tracking code"
              className="w-full border p-2 rounded"
            />

            <button
              onClick={handleShip}
              className="w-full bg-orange-500 text-white py-3 rounded"
            >
              Send return
            </button>
          </div>
        )}

      </section>

      {/* ================= PREVIEW ================= */}

      {previewIndex !== null && (
        <div className="fixed inset-0 z-[999] bg-black">

          {/* CLOSE */}
          <button
            onClick={() => setPreviewIndex(null)}
            className="absolute top-5 right-5 z-50 text-white text-2xl"
          >
            ✕
          </button>

          <Swiper
            modules={[Pagination]}
            pagination={{ clickable: true }}
            initialSlide={previewIndex}
            onSlideChange={(s) => {
              setPreviewIndex(s.activeIndex);
              setScale(1);
              setPosition({ x: 0, y: 0 });
            }}
          >
            {allImages.map((src, i) => (
              <SwiperSlide key={i}>
                <div className="flex items-center justify-center h-screen">

                  <img
                    src={getImage(src)}

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

                    /* PINCH */
                    onTouchStart={(e) => {
                      if (e.touches.length === 2) {
                        const dx = e.touches[0].clientX - e.touches[1].clientX;
                        const dy = e.touches[0].clientY - e.touches[1].clientY;

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
                      }
                    }}

                    onTouchMove={(e) => {
                      if (e.touches.length === 2) {
                        const dx = e.touches[0].clientX - e.touches[1].clientX;
                        const dy = e.touches[0].clientY - e.touches[1].clientY;

                        const dist = Math.sqrt(dx * dx + dy * dy);

                        let newScale = initialScale * (dist / initialDistance);
                        newScale = Math.max(1, Math.min(newScale, 6));
                        setScale(newScale);
                      }

                      if (e.touches.length === 1 && dragging && scale > 1) {
                        const t = e.touches[0];

                        setPosition({
                          x: t.clientX - start.x,
                          y: t.clientY - start.y,
                        });
                      }
                    }}

                    onTouchEnd={() => setDragging(false)}

                    style={{
                      transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    }}

                    className="max-w-full max-h-full object-contain"
                  />

                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      )}
    </main>
  );
}

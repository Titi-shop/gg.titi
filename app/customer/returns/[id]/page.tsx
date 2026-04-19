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
      console.error("LOAD ERROR", err);
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

      alert("Đã gửi hàng");

      // ✅ reload đúng chuẩn
      await loadReturn();

      setTrackingCode("");
      setShippingProvider("");

    } catch (err) {
      console.error(err);
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

  function getStatusColor(status: ReturnStatus) {
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
        return "text-green-700";
      case "rejected":
        return "text-red-600";
      default:
        return "text-gray-500";
    }
  }

  /* ================= IMAGES ================= */

  const allImages: string[] = [
    data?.product_thumbnail ?? "",
    ...(data?.evidence_images ?? []),
  ].filter((i) => typeof i === "string" && i.length > 5);

  /* ================= STATE ================= */

  if (loading) {
    return (
      <main className="p-4">
        <p>{t.loading ?? "Loading..."}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="p-4">
        <p className="text-red-500">
          {t.return_not_found ?? "Return not found"}
        </p>
      </main>
    );
  }

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* HEADER */}
      <header className="bg-orange-500 text-white px-4 py-4">
        <div className="bg-orange-400 rounded-lg p-4">
          <p className="text-sm">{t.return_detail ?? "Return Detail"}</p>
          <p className="text-xs mt-1">
            Order: #{data.order_id}
          </p>
        </div>
      </header>

      <section className="mt-6 px-4 space-y-4">

        {/* PRODUCT */}
        <div className="bg-white rounded-xl p-4 flex gap-3">
          <img
            src={getImage(data.product_thumbnail)}
            onClick={() => setPreviewIndex(0)}
            className="w-16 h-16 object-cover rounded border cursor-pointer"
          />

          <div className="flex-1">
            <p className="text-sm font-medium">
              {data.product_name}
            </p>

            <p className="text-xs text-gray-500">
              Qty: {data.quantity}
            </p>
          </div>
        </div>

        {/* IMAGES */}
        <div className="bg-white rounded-xl p-4">
          <p className="text-sm font-semibold mb-2">
            Evidence Images
          </p>

          {allImages.length === 0 ? (
            <p className="text-xs text-gray-400">No images</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto">
              {allImages.map((src, i) => (
                <img
                  key={i}
                  src={getImage(src)}
                  onClick={() => setPreviewIndex(i)}
                  className="w-24 h-24 object-cover rounded border cursor-pointer"
                />
              ))}
            </div>
          )}
        </div>

        {/* STATUS */}
        <div className="bg-white p-4 flex justify-between rounded-xl">
          <span>Status</span>
          <span className={getStatusColor(data.status)}>
            {data.status}
          </span>
        </div>

        {/* TRACKING */}
        {data.return_tracking_code && (
          <div className="bg-white p-4 rounded-xl text-xs text-blue-600">
            Tracking: {data.return_tracking_code}
          </div>
        )}

        {/* SHIPPING FORM */}
        {data.status === "approved" && (
          <div className="bg-white p-4 rounded-xl space-y-3">

            <p className="font-semibold text-sm">
              📦 Gửi hàng trả
            </p>

            <input
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              placeholder="Mã vận đơn"
              className="w-full border px-3 py-2 rounded text-sm"
            />

            <input
              value={shippingProvider}
              onChange={(e) => setShippingProvider(e.target.value)}
              placeholder="Đơn vị vận chuyển"
              className="w-full border px-3 py-2 rounded text-sm"
            />

            <button
              onClick={handleShip}
              disabled={sending}
              className="w-full bg-orange-500 text-white py-3 rounded-lg"
            >
              {sending ? "Đang gửi..." : "Xác nhận đã gửi hàng"}
            </button>
          </div>
        )}

        {/* REFUND */}
        <div className="bg-white p-4 flex justify-between rounded-xl">
          <span>Refund</span>
          <span className="font-semibold">
            π{data.refund_amount}
          </span>
        </div>

        {/* REASON */}
        {data.reason && (
          <div className="bg-white p-4 rounded-xl">
            <p className="font-medium">Reason</p>
            <p className="text-sm text-gray-600">
              {data.reason}
            </p>
          </div>
        )}

        {/* DATE */}
        <div className="bg-white p-4 flex justify-between rounded-xl">
          <span>Created</span>
          <span className="text-xs text-gray-500">
            {new Date(data.created_at).toLocaleString()}
          </span>
        </div>

      </section>

      {/* ================= PREVIEW ================= */}

      {previewIndex !== null && (
        <div className="fixed inset-0 z-[999] bg-black flex flex-col">

          <div className="flex justify-between p-4 text-white">
            <button onClick={() => setPreviewIndex(null)}>✕</button>
            <span>
              {previewIndex + 1}/{allImages.length}
            </span>
            <div />
          </div>

          <Swiper
            modules={[Pagination]}
            pagination={{ clickable: true }}
            initialSlide={previewIndex}
            onSlideChange={(s) => setPreviewIndex(s.activeIndex)}
            className="flex-1"
          >
            {allImages.map((src, i) => (
              <SwiperSlide key={i}>
                <div className="flex items-center justify-center h-full">
                  <img
                    src={getImage(src)}
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

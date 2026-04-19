"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { getPiAccessToken } from "@/lib/piAuth";
import { useAuth } from "@/context/AuthContext";

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

  evidence_images?: string[]; // ✅ thêm
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

  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  /* ================= LOAD ================= */

  useEffect(() => {
    if (authLoading || !user || !returnId) return;
    void loadReturn();
  }, [authLoading, user, returnId]);

  async function loadReturn(): Promise<void> {
    try {
      const token = await getPiAccessToken();
      if (!token) return;

      const res = await fetch(`/api/returns/${returnId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!res.ok) {
        setData(null);
        return;
      }

      const record: ReturnRecord = await res.json();

      console.log("📦 RETURN DETAIL:", record);

      setData(record);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
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

  /* ================= IMAGE LIST ================= */

  const allImages: string[] = [
    data?.product_thumbnail ?? "",
    ...(data?.evidence_images ?? []),
  ].filter((i) => typeof i === "string" && i.length > 5);

  /* ================= LOADING ================= */

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
          <p className="text-sm opacity-90">
            {t.return_detail ?? "Return Detail"}
          </p>

          <p className="text-xs opacity-80 mt-1">
            Order: #{data.order_id}
          </p>
        </div>
      </header>

      {/* CONTENT */}
      <section className="mt-6 px-4 space-y-4">

        {/* PRODUCT */}
        <div className="bg-white rounded-xl shadow-sm p-4 flex gap-3">
          <img
            src={getImage(data.product_thumbnail)}
            onClick={() => setPreviewIndex(0)}
            className="w-16 h-16 object-cover rounded border cursor-pointer"
          />

          <div className="flex-1">
            <p className="font-medium text-sm">
              {data.product_name}
            </p>

            <p className="text-xs text-gray-500">
              Qty: {data.quantity}
            </p>
          </div>
        </div>

        {/* EVIDENCE IMAGES */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm font-semibold mb-2">
            Evidence Images
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
                  src={getImage(src)}
                  onClick={() => setPreviewIndex(i)}
                  className="w-24 h-24 object-cover rounded border cursor-pointer"
                />
              ))}
            </div>
          )}
        </div>

        {/* STATUS */}
        <div className="bg-white rounded-xl shadow-sm p-4 flex justify-between">
          <span>Status</span>
          <span className={getStatusColor(data.status)}>
            {data.status}
          </span>
        </div>

        {/* REFUND */}
        <div className="bg-white rounded-xl shadow-sm p-4 flex justify-between">
          <span>Refund</span>
          <span className="font-semibold">
            π{data.refund_amount}
          </span>
        </div>

        {/* REASON */}
        {data.reason && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="font-medium mb-1">Reason</p>
            <p className="text-gray-600 text-sm">
              {data.reason}
            </p>
          </div>
        )}

        {/* DATE */}
        <div className="bg-white rounded-xl shadow-sm p-4 flex justify-between">
          <span>Created</span>
          <span className="text-xs text-gray-500">
            {new Date(data.created_at).toLocaleString()}
          </span>
        </div>

      </section>

      {/* ================= PREVIEW ================= */}

      {previewIndex !== null && (
        <div className="fixed inset-0 z-[999] bg-black flex flex-col">

          {/* HEADER */}
          <div className="flex justify-between p-4 text-white">
            <button onClick={() => setPreviewIndex(null)}>✕</button>
            <span>
              {previewIndex + 1}/{allImages.length}
            </span>
            <div />
          </div>

          {/* SWIPER */}
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

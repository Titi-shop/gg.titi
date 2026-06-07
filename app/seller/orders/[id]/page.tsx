"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import useSWR from "swr";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { formatPi } from "@/lib/pi";
import { useMemo, useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/* ================= TYPES ================= */
type RawItem = {
  id?: string;
  product_id?: string | null;
  product_name?: string;
  thumbnail?: string;
  variant_name?: string;
  variant_value?: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
  status?: string;
};
interface OrderItem {
  id: string;
  product_id: string | null;
  product_name: string;
  thumbnail: string;

  variant_name: string;
  variant_value: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: string;
}

interface Order {
  id: string;
  order_number: string;
  created_at: string;

  confirmed_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;

  shipping_name: string;
  shipping_phone: string;

  shipping_address_line: string;
  shipping_ward: string | null;
  shipping_district: string | null;
  shipping_region: string | null;
  shipping_country: string | null;
  shipping_postal_code: string | null;

  total: number;
  order_items: OrderItem[];
}

/* ================= HELPERS ================= */

function formatDate(date: string) {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function safeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/* ================= FETCHER ================= */

const fetcher = async (url: string): Promise<Order | null> => {
  try {
    const res = await apiAuthFetch(url);

    if (!res.ok) return null;

    const data = await res.json();

    const items: OrderItem[] = (data.order_items || []).map((i: RawItem) => ({
    id: safeString(i.id),
    product_id: i.product_id ?? null,
    product_name: safeString(i.product_name),
    thumbnail: safeString(i.thumbnail),

    variant_name: safeString(i.variant_name),
    variant_value: safeString(i.variant_value),

    quantity: safeNumber(i.quantity),
    unit_price: safeNumber(i.unit_price),
    total_price: safeNumber(i.total_price),

    status: safeString(i.status),
  })
);

    return {
  id: safeString(data.id),
  order_number: safeString(data.order_number),
  created_at: safeString(data.created_at),

  confirmed_at: data.confirmed_at ?? null,
  shipped_at: data.shipped_at ?? null,
  delivered_at: data.delivered_at ?? null,
  cancelled_at: data.cancelled_at ?? null,

  shipping_name: safeString(data.shipping_name),
  shipping_phone: safeString(data.shipping_phone),

  shipping_address_line: safeString(data.shipping_address_line),
  shipping_ward: safeString(data.shipping_ward),
  shipping_district: safeString(data.shipping_district),
  shipping_region: safeString(data.shipping_region),

  shipping_country: safeString(data.shipping_country),
  shipping_postal_code: safeString(data.shipping_postal_code),

  total: safeNumber(data.total),
  order_items: items,
};
  } catch {
    return null;
  }
};
function OrderTimeline(order: Order) {
  const steps = [
    { key: "pending", label: "Pending", time: order.created_at },
    { key: "confirmed", label: "Confirmed", time: order.confirmed_at },
    { key: "shipping", label: "Shipping", time: order.shipped_at },
    { key: "completed", label: "Completed", time: order.delivered_at },
    { key: "cancelled", label: "Cancelled", time: order.cancelled_at },
  ];

  const current =
    order.cancelled_at
      ? "cancelled"
      : order.delivered_at
      ? "completed"
      : order.shipped_at
      ? "shipping"
      : order.confirmed_at
      ? "confirmed"
      : "pending";

  return (
    <div className="mb-4 p-3 bg-gray-50 rounded border">
      <h2 className="font-semibold mb-2">Order Timeline</h2>

      <div className="space-y-3">
        {steps.map((s) => {
          const active = !!s.time;
          const isCurrent = current === s.key;

          return (
            <div key={s.key} className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  isCurrent
                    ? "bg-blue-600 scale-125"
                    : active
                    ? "bg-green-500"
                    : "bg-gray-300"
                }`}
              />

              <div>
                <div
                  className={`text-sm font-medium ${
                    isCurrent ? "text-blue-600" : ""
                  }`}
                >
                  {s.label}
                </div>

                <div className="text-xs text-gray-400">
                  {s.time
                    ? formatDate(s.time)
                    : "Waiting"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================= PAGE ================= */

export default function SellerOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const id =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : undefined;

  /* ================= SWR ================= */

  const { data: order, isLoading } = useSWR(
    !authLoading && user && id
      ? `/api/seller/orders/${id}`
      : null,
    fetcher
  );

  /* ================= QR ================= */

  const [qr, setQr] = useState<string>("");

  useEffect(() => {
    if (!order?.id) return;

    QRCode.toDataURL(`order:${order.id}`)
      .then(setQr)
      .catch(() => {});
  }, [order]);

  /* ================= TOTAL ================= */

  const total = useMemo(() => {
    if (!order) return 0;
    if (order.total) return order.total;

    return order.order_items.reduce(
      (sum, i) => sum + i.total_price,
      0
    );
  }, [order]);

  /* ================= PDF ================= */

  const [generating, setGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handleOpenPDF = async () => {
    try {
      const el = printRef.current;
      if (!el) return;

      setGenerating(true);

      const canvas = await html2canvas(el, { scale: 2 });
      const img = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");

      const width = 210;
      const height = (canvas.height * width) / canvas.width;

      pdf.addImage(img, "PNG", 0, 10, width, height);

      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);

      window.location.href = url;
    } catch {
      alert("Không thể tạo PDF");
    } finally {
      setGenerating(false);
    }
  };

  /* ================= LOADING ================= */

  if (isLoading || authLoading) {
    return <p className="text-center mt-10">Loading...</p>;
  }

  if (!order) {
    return (
      <p className="text-center mt-10 text-red-500">
        Order not found
      </p>
    );
  }

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-100 p-4">

      {/* ACTION */}
      <div className="flex justify-between mb-4">
        <button
          onClick={() => router.back()}
          className="px-3 py-2 border rounded"
        >
          Back
        </button>

        <button
          onClick={handleOpenPDF}
          disabled={generating}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          {generating ? "Đang tạo..." : "📄 Xem / In"}
        </button>
      </div>

      {/* INVOICE */}
      <section
        ref={printRef}
        className="bg-white p-4 border shadow max-w-xl mx-auto"
      >
        <h1 className="text-lg font-bold text-center mb-3">
  DELIVERY NOTE
</h1>

{qr && (
  <div className="flex justify-center mb-3">
    <img src={qr} alt="QR" />
  </div>
)}

{/* 🔥 TIMELINE */}
{OrderTimeline(order)}
        <div className="text-sm space-y-1 mb-4">
          <p><b>Receiver:</b> {order.shipping_name}</p>
          <p><b>Phone:</b> {order.shipping_phone}</p>
          <p>
  <b>Address:</b>{" "}
  {[
    order.shipping_address_line,
    order.shipping_ward,
    order.shipping_district,
    order.shipping_region,
  ]
    .filter(Boolean)
    .join(", ")}
</p>
          <p><b>Country:</b> {order.shipping_country}</p>
          <p><b>Postal:</b> {order.shipping_postal_code}</p>
          <p><b>Created:</b> {formatDate(order.created_at)}</p>
        </div>

        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1">#</th>
              <th className="border px-2 py-1">Product</th>
              <th className="border px-2 py-1">Qty</th>
              <th className="border px-2 py-1 text-right">π</th>
            </tr>
          </thead>

          <tbody>
  {order.order_items.map((item, i) => (
    <tr key={item.id}>
      <td className="border px-2 py-1">{i + 1}</td>

      <td className="border px-2 py-1">
        <div className="flex gap-2 items-center">
          {item.thumbnail && (
            <img
              src={item.thumbnail}
              className="w-10 h-10 object-cover rounded"
            />
          )}

          <div>
            <div className="font-medium">
              {item.product_name}
            </div>

            {(item.variant_name || item.variant_value) && (
              <div className="text-xs text-gray-500">
                {item.variant_name}: {item.variant_value}
              </div>
            )}
            <div className="text-xs mt-1">
        Status:{" "}
<span
  className={`font-medium ${
    item.status === "completed"
      ? "text-green-600"
      : item.status === "shipping"
      ? "text-blue-600"
      : item.status === "confirmed"
      ? "text-yellow-600"
      : item.status === "cancelled"
      ? "text-red-600"
      : "text-gray-500"
  }`}
>
  {item.status}
</span>
          </div>
          </div>
        </div>
      </td>

      <td className="border px-2 py-1 text-center">
        {item.quantity}
      </td>

      <td className="border px-2 py-1 text-right">
        π{formatPi(item.total_price)}
      </td>
    </tr>
  ))}
</tbody>
        </table>

        <div className="mt-4 text-right font-semibold">
          Total: π{formatPi(total)}
        </div>
      </section>
    </main>
  );
}

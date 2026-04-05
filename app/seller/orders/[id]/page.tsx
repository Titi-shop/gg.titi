"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { formatPi } from "@/lib/pi";
import { useEffect, useMemo, useState, useRef } from "react";
import QRCode from "qrcode";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/* ================= TYPES ================= */

interface OrderItem {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Order {
  id: string;
  order_number: string;
  created_at: string;

  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
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

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [qr, setQr] = useState<string>("");

  const printRef = useRef<HTMLDivElement>(null);

  /* ================= TOTAL ================= */

  const total = useMemo(() => {
    if (!order) return 0;
    if (order.total) return order.total;

    return order.order_items.reduce(
      (sum, i) => sum + i.total_price,
      0
    );
  }, [order]);

  /* ================= LOAD ================= */

  useEffect(() => {
    if (authLoading || !user || !id) return;

    const load = async () => {
      try {
        const res = await apiAuthFetch(`/api/seller/orders/${id}`);

        if (!res.ok) {
          setOrder(null);
          return;
        }

        const data = await res.json();

        const items: OrderItem[] = (data.order_items || []).map((i: any) => ({
          id: i.id,
          product_id: i.product_id,
          product_name: safeString(i.product_name),
          quantity: safeNumber(i.quantity),
          unit_price: safeNumber(i.unit_price),
          total_price: safeNumber(i.total_price),
        }));

        setOrder({
          id: safeString(data.id),
          order_number: safeString(data.order_number),
          created_at: safeString(data.created_at),
          shipping_name: safeString(data.shipping_name),
          shipping_phone: safeString(data.shipping_phone),
          shipping_address: safeString(data.shipping_address),
          shipping_country: data.shipping_country ?? null,
          shipping_postal_code: data.shipping_postal_code ?? null,
          total: safeNumber(data.total),
          order_items: items,
        });
      } catch {
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [authLoading, user, id]);

  /* ================= QR ================= */

  useEffect(() => {
    if (!order?.id) return;

    QRCode.toDataURL(`order:${order.id}`)
      .then(setQr)
      .catch(() => {});
  }, [order]);

  /* ================= PDF ================= */

  const handleOpenPDF = async () => {
    const el = printRef.current;
    if (!el) return;

    const canvas = await html2canvas(el, { scale: 2 });
    const img = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");

    const width = 210;
    const height = (canvas.height * width) / canvas.width;

    pdf.addImage(img, "PNG", 0, 10, width, height);

    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);

    window.open(url);
  };

  /* ================= UI ================= */

  if (loading) {
    return <p className="text-center mt-10">Loading...</p>;
  }

  if (!order) {
    return <p className="text-center mt-10 text-red-500">Order not found</p>;
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">

      {/* ACTIONS */}
      <div className="flex justify-end gap-2 mb-6">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 border rounded"
        >
          Back
        </button>

        <button
          onClick={handleOpenPDF}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          📄 Xem / In hóa đơn
        </button>
      </div>

      {/* INVOICE */}
      <section
        ref={printRef}
        className="max-w-2xl mx-auto bg-white p-6 border shadow"
      >
        <h1 className="text-xl font-bold text-center mb-4">
          DELIVERY NOTE
        </h1>

        {qr && (
          <div className="flex justify-center mb-4">
            <img src={qr} alt="QR" />
          </div>
        )}

        <div className="text-sm space-y-1 mb-6">
          <p><b>Receiver:</b> {order.shipping_name}</p>
          <p><b>Phone:</b> {order.shipping_phone}</p>
          <p><b>Address:</b> {order.shipping_address}</p>
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
                <td className="border px-2 py-1">{item.product_name}</td>
                <td className="border px-2 py-1 text-center">{item.quantity}</td>
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

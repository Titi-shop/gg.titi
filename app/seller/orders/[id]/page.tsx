"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { formatPi } from "@/lib/pi";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useEffect, useMemo, useState, useRef } from "react";
import QRCode from "qrcode.react";
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
  shipping_provider: string | null;
  shipping_country: string | null;
  shipping_postal_code: string | null;

  total: number;
  order_items: OrderItem[];
}

/* ================= HELPERS ================= */

function formatDate(date: string) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
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
  const { t } = useTranslation();

  const id =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : undefined;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

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

  /* ================= PRINT ================= */

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const win = window.open("", "", "width=800,height=900");
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>Print</title>
          <style>
            body { font-family: Arial; padding: 20px; }
            table { width: 100%; border-collapse: collapse; }
            td, th { border: 1px solid #ccc; padding: 6px; }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `);

    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  /* ================= PDF ================= */

  const handleDownloadPDF = async () => {
    const element = printRef.current;
    if (!element) return;

    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");

    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    pdf.save(`order-${order?.order_number}.pdf`);
  };

  /* ================= LOAD ORDER ================= */

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    if (!id) return;

    const loadOrder = async () => {
      try {
        const res = await apiAuthFetch(
          `/api/seller/orders/${id}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          setOrder(null);
          setLoading(false);
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
          shipping_provider: data.shipping_provider ?? null,
          shipping_country: data.shipping_country ?? null,
          shipping_postal_code: data.shipping_postal_code ?? null,
          total: safeNumber(data.total),
          order_items: items,
        });
      } catch (err) {
        console.error("ORDER LOAD ERROR:", err);
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [authLoading, user, id]);

  /* ================= UI ================= */

  if (loading) {
    return <p className="text-center mt-10">Loading...</p>;
  }

  if (!order) {
    return <p className="text-center mt-10 text-red-500">Order not found</p>;
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">

      {/* BUTTONS */}
      <div className="flex justify-end gap-2 mb-6">
        <button onClick={() => router.back()} className="px-4 py-2 border rounded">
          Back
        </button>

        <button onClick={handlePrint} className="px-4 py-2 bg-black text-white rounded">
          Print
        </button>

        <button onClick={handleDownloadPDF} className="px-4 py-2 bg-blue-600 text-white rounded">
          Save PDF
        </button>
      </div>

      {/* PRINT AREA */}
      <section
        ref={printRef}
        className="max-w-2xl mx-auto bg-white p-6 border shadow"
      >
        <h1 className="text-xl font-semibold mb-6 text-center">
          Delivery Note
        </h1>

        {/* QR */}
        <div className="flex justify-center mb-4">
          <QRCode value={`order:${order.id}`} size={100} />
        </div>

        {/* SHIPPING */}
        <div className="space-y-1 text-sm mb-6">
          <p><b>Receiver:</b> {order.shipping_name}</p>
          <p><b>Phone:</b> {order.shipping_phone}</p>
          <p><b>Address:</b> {order.shipping_address}</p>
          <p><b>Country:</b> {order.shipping_country}</p>
          <p><b>Postal:</b> {order.shipping_postal_code}</p>
          <p><b>Created:</b> {formatDate(order.created_at)}</p>
        </div>

        {/* ITEMS */}
        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1">#</th>
              <th className="border px-2 py-1">Product</th>
              <th className="border px-2 py-1">Qty</th>
              <th className="border px-2 py-1">π</th>
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

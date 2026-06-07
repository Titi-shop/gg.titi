"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

/* =========================
   TYPES (NO any)
========================= */
interface UnpaidOrder {
  id: string;
  total: number;
  status: string;
  createdAt: string;
}

/* =========================
   PAGE
========================= */
export default function UnpaidOrdersPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [orders, setOrders] = useState<UnpaidOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  /* =========================
     LOAD UNPAID ORDERS
     - SERVER FILTER
  ========================= */
  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiAuthFetch("/api/orders/unpaid", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("LOAD_UNPAID_FAILED");
        }

        const data: unknown = await res.json();
        setOrders(Array.isArray(data) ? (data as UnpaidOrder[]) : []);
      } catch (err) {
        console.error("❌ Load unpaid orders error:", err);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  /* =========================
     REPAY (SERVER HANDLES PI)
  ========================= */
  const repay = async (orderId: string) => {
    if (processingId) return;
    setProcessingId(orderId);

    try {
      const res = await apiAuthFetch(`/api/orders/${orderId}/repay`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("REPAY_FAILED");
      }

      alert(t.payment_processing || "Đang xử lý thanh toán");
      router.push("/customer/pending");
    } catch (err) {
      console.error("❌ Repay failed:", err);
      alert(t.payment_error || "Thanh toán thất bại");
    } finally {
      setProcessingId(null);
    }
  };

  /* =========================
     CANCEL ORDER
  ========================= */
  const cancelOrder = async (orderId: string) => {
    if (!confirm(t.confirm_cancel_order || "Huỷ đơn hàng này?")) {
      return;
    }

    try {
      const res = await apiAuthFetch(
        `/api/orders/${orderId}/cancel`,
        { method: "POST" }
      );

      if (!res.ok) {
        throw new Error("CANCEL_FAILED");
      }

      setOrders(prev => prev.filter(o => o.id !== orderId));
      alert(t.order_canceled || "Đã huỷ đơn hàng");
    } catch (err) {
      console.error("❌ Cancel order error:", err);
      alert(t.cancel_failed || "Không thể huỷ đơn");
    }
  };

  /* =========================
     UI STATES
  ========================= */
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-gray-500">
        ⏳ {t.loading || "Đang tải"}...
      </main>
    );
  }

  /* =========================
     UI
  ========================= */
  return (
    <main className="min-h-screen bg-gray-100 p-4 pb-24">
      <header className="flex items-center mb-4">
        <button
          onClick={() => router.back()}
          className="text-orange-600 font-bold mr-3"
        >
          ←
        </button>
        <h1 className="text-lg font-semibold text-red-600">
          🔴 {t.unpaid_orders || "Đơn chưa thanh toán"}
        </h1>
      </header>

      {orders.length === 0 ? (
        <p className="text-center text-gray-500 mt-12">
          {t.no_unpaid_orders || "Không có đơn chưa thanh toán"}
        </p>
      ) : (
        <div className="space-y-3">
          {orders.map(o => (
            <div
              key={o.id}
              className="bg-white p-4 rounded-lg shadow"
            >
              <div className="flex justify-between">
                <span className="font-semibold">#{o.id}</span>
                <span className="text-sm text-red-500">
                  {o.status}
                </span>
              </div>

              <p className="mt-2 text-sm">
                💰 {t.total || "Tổng"}: π{o.total}
              </p>

              <p className="text-xs text-gray-500">
                📅 {new Date(o.createdAt).toLocaleString()}
              </p>

              <div className="flex gap-2 mt-3">
                <button
                  disabled={processingId === o.id}
                  onClick={() => repay(o.id)}
                  className="flex-1 bg-green-500 text-white py-2 rounded disabled:opacity-50"
                >
                  💳 {t.pay_now || "Thanh toán"}
                </button>

                <button
                  onClick={() => cancelOrder(o.id)}
                  className="flex-1 bg-gray-400 text-white py-2 rounded"
                >
                  ❌ {t.cancel || "Huỷ"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

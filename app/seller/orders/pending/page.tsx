"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
import useSWR from "swr";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { formatPi } from "@/lib/pi";
import { useAuth } from "@/context/AuthContext"
/* ================= TYPES ================= */

interface OrderItem {
  id: string;
  product_id: string | null;
  product_name: string;
  thumbnail: string;
  images: string[] | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: string;
}

type OrderStatus = "pending" | "confirmed" | "cancelled";

interface Order {
  id: string;
  order_number: string;

  status: OrderStatus;

  total: number;
  created_at: string;

  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;

  shipping_provider?: string | null;
  shipping_country?: string | null;
  shipping_postal_code?: string | null;

  order_items: OrderItem[];
}

/* ================= HELPERS ================= */



function formatDate(date: string): string {
  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    return "—";
  }

  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
const fetcher = async (): Promise<Order[]> => {
  try {
    const res = await apiAuthFetch(
      "/api/seller/orders?status=pending",
      { cache: "no-store" }
    );

    if (!res.ok) return [];

    const data: unknown = await res.json();

    return Array.isArray(data) ? (data as Order[]) : [];
  } catch {
    return [];
  }
};
/* ================= PAGE ================= */

export default function SellerPendingOrdersPage() {
  const router = useRouter();
  const { t } = useTranslation();
const { user, loading: authLoading } = useAuth();
  const {
  data: orders = [],
  isLoading,
  mutate,
} = useSWR(
  !authLoading && user
    ? "/api/seller/orders?status=pending"
    : null,
  fetcher
);
  const SELLER_CANCEL_REASONS: string[] = [
    t.cancel_reason_out_of_stock ?? "Out of stock",
    t.cancel_reason_discontinued ?? "Product discontinued",
    t.cancel_reason_wrong_price ?? "Wrong price",
    t.cancel_reason_other ?? "Other",
  ];

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showConfirmFor, setShowConfirmFor] = useState<string | null>(null);
  const [sellerMessage, setSellerMessage] = useState<string>("");
  const [showCancelFor, setShowCancelFor] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");

  const totalPi = useMemo(
  () =>
    orders.reduce(
      (sum, o) => sum + Number(o.total ?? 0),
      0
    ),
  [orders]
);

  /* ================= CONFIRM ================= */

  async function handleConfirm(orderId: string): Promise<void> {
  if (!sellerMessage.trim()) return;

  try {
    setProcessingId(orderId);

    const previous = orders;

    // 🚀 optimistic: xoá ngay khỏi UI
    await mutate(
      orders.filter((o) => o.id !== orderId),
      false
    );

    const res = await apiAuthFetch(
      `/api/seller/orders/${orderId}/confirm`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seller_message: sellerMessage,
        }),
      }
    );

    if (!res.ok) {
      // 🔴 rollback nếu fail
      await mutate(previous, false);
      return;
    }

    setShowConfirmFor(null);
    setSellerMessage("");

    mutate(); // sync lại server
  } catch {
    mutate(); // fallback
  } finally {
    setProcessingId(null);
  }
}

  /* ================= CANCEL ================= */

  async function handleCancel(orderId: string): Promise<void> {
  const finalReason =
    selectedReason === (t.cancel_reason_other ?? "Other")
      ? customReason
      : selectedReason;

  if (!finalReason.trim()) return;

  try {
    setProcessingId(orderId);

    const previous = orders;

    // 🚀 optimistic remove
    await mutate(
      orders.filter((o) => o.id !== orderId),
      false
    );

    const res = await apiAuthFetch(
      `/api/seller/orders/${orderId}/cancel`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cancel_reason: finalReason,
        }),
      }
    );

    if (!res.ok) {
      // 🔴 rollback
      await mutate(previous, false);
      return;
    }

    setShowCancelFor(null);
    setSelectedReason("");
    setCustomReason("");

    mutate();
  } catch {
    mutate();
  } finally {
    setProcessingId(null);
  }
}

  /* ================= LOADING ================= */

 if (isLoading || authLoading) {
    return (
      <p className="text-center mt-10 text-gray-400">
        {t.loading ?? "Đang tải..."}
      </p>
    );
  }

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-100 pb-24">
      {/* HEADER */}
      <header className="bg-gray-600 text-white px-4 py-4">
        <div className="bg-gray-500 rounded-lg p-4">
          <p className="text-sm opacity-90">
            {t.pending_orders ?? "Đơn chờ xác nhận"}
          </p>
          <p className="text-xs opacity-80 mt-1">
            {t.orders ?? "Đơn hàng"}: {orders.length} · π
            {formatPi(totalPi)}
          </p>
        </div>
      </header>

      <section className="mt-6 px-4 space-y-4">
        {orders.length === 0 ? (
          <p className="text-center text-gray-400">
            {t.no_pending_orders ?? "Không có đơn chờ"}
          </p>
        ) : (
          orders.map((o) => (
            <div
              key={o.id}
              onClick={() => {
                if (expandedId === o.id) {
                  router.push(`/seller/orders/${o.id}`);
                } else {
                  setExpandedId(o.id);
                }
              }}
              className="bg-white rounded-xl shadow-sm overflow-hidden border"
            >
              {/* ORDER HEADER */}
              <div className="flex justify-between px-4 py-3 border-b bg-gray-50">
                <div>
                  <p className="font-semibold text-sm">
                    #{o.order_number}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(o.created_at)}
                  </p>
                </div>

                <span className="text-yellow-600 text-sm font-medium">
                  {t.status_pending ?? "Chờ xác nhận"}
                </span>
              </div>

              {/* SHIPPING INFO */}
              
              <div className="px-4 py-3 text-sm space-y-1 border-b">

                <p>
                  <span className="text-gray-500">
                    {t.customer ?? "Customer"}:
                  </span>{" "}
                  {o.shipping_name}
                </p>

                <p>
                  <span className="text-gray-500">
                    {t.phone ?? "Phone"}:
                  </span>{" "}
                  {o.shipping_phone}
                </p>

                <p className="text-gray-600 text-xs">
                  {o.shipping_address}
                </p>

                {(o.shipping_provider ||
                  o.shipping_country ||
                  o.shipping_postal_code) && (

                  <p className="text-xs text-gray-500">

                    {o.shipping_provider && (
                      <span>{o.shipping_provider}</span>
                    )}

                    {o.shipping_country && (
                      <span> · {o.shipping_country}</span>
                    )}

                    {o.shipping_postal_code && (
                      <span> · {o.shipping_postal_code}</span>
                    )}

                  </p>
                )}

              </div>

              {/* PRODUCTS */}
              <div className="divide-y">
                {o.order_items.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 p-4"
                  >
                    <div className="w-14 h-14 bg-gray-100 rounded-lg overflow-hidden">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.product_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">
                        {item.product_name}
                      </p>

                      <p className="text-xs text-gray-500 mt-1">
                        x{item.quantity} · π
                        {formatPi(item.unit_price)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

               {/* FOOTER */}
              <div
                className="px-4 py-3 border-t bg-gray-50 text-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold">
                {t.total ?? "Total"}: π{formatPi(Number(o.total ?? 0))}
            </span>

                  <div className="flex gap-2">
                    <button
                      disabled={processingId === o.id}
                      onClick={() => {
                        setSellerMessage(
                          t.confirm_default_message ??
                            "Thank you for your order. "
                        );
                        setShowConfirmFor(o.id);
                        setShowCancelFor(null);
                      }}
                      className="px-3 py-1.5 text-xs bg-gray-700 text-white rounded-lg disabled:opacity-50"
                    >
                      {t.confirm ?? "Xác nhận"}
                    </button>

                    <button
                      disabled={processingId === o.id}
                      onClick={() => {
                        setShowCancelFor(o.id);
                        setShowConfirmFor(null);
                      }}
                      className="px-3 py-1.5 text-xs border border-gray-400 rounded-lg"
                    >
                      {t.cancel ?? "Huỷ"}
                    </button>
                  </div>
                </div>

                {/* CONFIRM FORM */}
                {showConfirmFor === o.id && (
                  <div className="mt-3 space-y-3 bg-gray-50 p-3 rounded-lg">
                    <textarea
                      value={sellerMessage}
                      onChange={(e) => setSellerMessage(e.target.value)}
                      className="w-full border rounded-md p-2 text-sm"
                      rows={3}
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleConfirm(o.id)}
                        disabled={processingId === o.id}
                        className="px-4 py-1 text-sm bg-green-600 text-white rounded disabled:opacity-50"
                      >
                        {t.confirm_order ?? "Confirm order"}
                      </button>

                      <button
                        onClick={() => {
                          setShowConfirmFor(null);
                          setSellerMessage("");
                        }}
                        className="px-4 py-1 text-sm border rounded"
                      >
                        {t.close ?? "Close"}
                      </button>
                    </div>
                  </div>
                )}

                {/* CANCEL FORM */}
                {showCancelFor === o.id && (
                  <div className="mt-3 space-y-3 bg-gray-50 p-3 rounded-lg">
                    {SELLER_CANCEL_REASONS.map((reason) => (
                      <label
                        key={reason}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="radio"
                          value={reason}
                          checked={selectedReason === reason}
                          onChange={(e) => setSelectedReason(e.target.value)}
                        />
                        {reason}
                      </label>
                    ))}

                    {selectedReason ===
                      (t.cancel_reason_other ?? "Other") && (
                      <textarea
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        className="w-full border rounded-md p-2 text-sm"
                        rows={3}
                      />
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCancel(o.id)}
                        disabled={processingId === o.id}
                        className="px-4 py-1 text-sm bg-red-500 text-white rounded disabled:opacity-50"
                      >
                        {t.confirm_cancel ?? "Confirm cancel"}
                      </button>

                      <button
                        onClick={() => {
                          setShowCancelFor(null);
                          setSelectedReason("");
                          setCustomReason("");
                        }}
                        className="px-4 py-1 text-sm border rounded"
                      >
                        {t.close ?? "Close"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}

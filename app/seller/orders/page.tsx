"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { formatPi } from "@/lib/pi";

import OrdersList from "@/components/OrdersList";
import OrderActions from "@/components/OrderActions";

/* ================= TYPES ================= */

type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipping"
  | "completed"
  | "returned"
  | "cancelled";

interface RawOrderItem {
  id: string;
  product_name?: string;
  thumbnail?: string;
  quantity?: number;
  unit_price?: number;
  status?: string;
}

interface RawOrder {
  id: string;
  order_number: string;
  total: number | string;
  created_at: string;
  shipping_name?: string;
  shipping_phone?: string;
  order_items?: RawOrderItem[];
}

interface OrderItem {
  id: string;
  product_name: string;
  thumbnail: string;
  quantity: number;
  unit_price: number;
}

interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  shipping_name: string;
  shipping_phone: string;
  order_items: OrderItem[];
}

/* ================= FETCH ================= */

const fetcher = async (): Promise<Order[]> => {
  const res = await apiAuthFetch("/api/seller/orders", {
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  return data.map((o: RawOrder) => {
    const status =
      (o.order_items?.[0]?.status as OrderStatus) ??
      "pending";

    return {
      id: o.id,
      order_number: o.order_number,
      status,
      total: Number(o.total ?? 0),
      created_at: o.created_at,
      shipping_name: o.shipping_name ?? "",
      shipping_phone: o.shipping_phone ?? "",
      order_items: (o.order_items ?? []).map((i) => ({
        id: i.id,
        product_name: i.product_name ?? "",
        thumbnail: i.thumbnail ?? "",
        quantity: Number(i.quantity ?? 0),
        unit_price: Number(i.unit_price ?? 0),
      })),
    };
  });
};

/* ================= PAGE ================= */

export default function SellerOrdersPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const { data: orders = [], isLoading, mutate } = useSWR(
    !authLoading && user ? "/api/seller/orders" : null,
    fetcher
  );

  /* ================= STATE ================= */

  const [processingId, setProcessingId] = useState<string | null>(null);
const [customReason, setCustomReason] = useState("");
  const [showConfirmFor, setShowConfirmFor] = useState<string | null>(null);
  const [sellerMessage, setSellerMessage] = useState("");
 const [currentTab, setCurrentTab] = useState<OrderStatus | "all">("pending");
  const [showCancelFor, setShowCancelFor] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState("");

  const [confirmShippingId, setConfirmShippingId] = useState<string | null>(null);
const SELLER_CANCEL_REASONS = [
  t.cancel_reason_out_of_stock ?? "Out of stock",
  t.cancel_reason_discontinued ?? "Discontinued",
  t.cancel_reason_wrong_price ?? "Wrong price",
  t.cancel_reason_other ?? "Other",
];
  /* ================= TOTAL ================= */

  const totalPi = useMemo(
    () => orders.reduce((s, o) => s + o.total, 0),
    [orders]
  );
  const statsByStatus = useMemo(() => {
  const map: Record<OrderStatus | "all", { count: number; total: number }> = {
    all: { count: 0, total: 0 },
    pending: { count: 0, total: 0 },
    confirmed: { count: 0, total: 0 },
    shipping: { count: 0, total: 0 },
    completed: { count: 0, total: 0 },
    returned: { count: 0, total: 0 },
    cancelled: { count: 0, total: 0 },
  };

  for (const o of orders) {
    map.all.count++;
    map.all.total += o.total;

    if (map[o.status]) {
      map[o.status].count++;
      map[o.status].total += o.total;
    }
  }

  return map;
}, [orders]);

  /* ================= ACTIONS ================= */

  async function handleConfirm(id: string) {
    if (!sellerMessage.trim()) return;

    try {
      setProcessingId(id);

      await apiAuthFetch(`/api/seller/orders/${id}/confirm`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ seller_message: sellerMessage }),
});

      setShowConfirmFor(null);
      setSellerMessage("");
      mutate();
    } finally {
      setProcessingId(null);
    }
  }

  async function handleCancel(id: string) {
  const reason =
    selectedReason === (t.cancel_reason_other ?? "Other")
      ? customReason
      : selectedReason;

  // ✅ THÊM ĐOẠN NÀY Ở ĐÂY
  if (!reason.trim()) {
    alert(t.select_reason ?? "Please select reason");
    return;
  }

  try {
    setProcessingId(id);

    await apiAuthFetch(`/api/seller/orders/${id}/cancel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancel_reason: reason }),
    });

    setShowCancelFor(null);
    setSelectedReason("");
    setCustomReason("");

    mutate();
  } finally {
    setProcessingId(null);
  }
}

  async function handleShipping(id: string) {
  try {
    setProcessingId(id);

    await apiAuthFetch(`/api/seller/orders/${id}/shipping`, {
      method: "PATCH",
    });

    setConfirmShippingId(null);
    mutate();
  } finally {
    setProcessingId(null);
  }
}
  /* ================= LOADING ================= */

  if (isLoading || authLoading) {
    return <p className="text-center mt-10">Loading...</p>;
  }

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* HEADER */}
      <header className="bg-gray-600 text-white px-4 py-4">
        <div className="bg-gray-500 rounded-lg p-4">
          <p>
       t[`${currentTab}_orders` as keyof typeof t] ??
currentTab.toUpperCase()
     </p>

      <p className="text-xs">
  {statsByStatus[currentTab].count} · π
  {formatPi(statsByStatus[currentTab].total)}
       </p>
        </div>
      </header>

      <OrdersList
        orders={orders}
        onClick={() => {}}
        initialTab="pending"
       onTabChange={(tab) => setCurrentTab(tab)}
        renderActions={(o) => (
          <OrderActions
            status={o.status}
            loading={processingId === o.id}

            onDetail={() =>
              router.push(`/seller/orders/${o.id}`)
            }

            onConfirm={() => {
      setSellerMessage(
    t.order_thank_you_message ??
    "Thank you for your order ❤️"
  );

    setShowConfirmFor(o.id);
    setShowCancelFor(null);
   }}

            onCancel={() => {
  setSelectedReason("");
  setCustomReason("");

  setShowCancelFor(o.id);
  setShowConfirmFor(null);
}}

            onShipping={() => {
              setConfirmShippingId(o.id);
            }}
          />
        )}

        renderExtra={(o) => (
          <>
            {/* CONFIRM */}
            {showConfirmFor === o.id && (
  <div className="bg-white p-4 rounded-xl border mt-2 shadow-sm space-y-3">

    <p className="text-sm font-medium">
      {t.confirm_order ?? "Confirm order"}
    </p>

    {/* QUICK MESSAGE */}
    <div className="flex gap-2 flex-wrap">
      {[
        t.quick_thank_you ?? "Thank you ❤️",
        t.quick_ship_soon ?? "We will ship soon 🚚",
        t.quick_have_nice_day ?? "Have a nice day 🌟",
      ].map((msg) => (
        <button
          key={msg}
          onClick={() => setSellerMessage(msg)}
          className="text-xs border px-2 py-1 rounded-lg active:scale-95"
        >
          {msg}
        </button>
      ))}
    </div>

    {/* TEXTAREA */}
    <textarea
      value={sellerMessage}
      onChange={(e) => setSellerMessage(e.target.value)}
      className="w-full border rounded-lg p-2 text-sm"
      rows={3}
      placeholder={t.enter_message ?? "Enter message to customer"}
    />

    {/* BUTTON */}
    <button
      onClick={() => handleConfirm(o.id)}
      className="w-full bg-green-600 text-white py-2 rounded-lg active:scale-95 disabled:opacity-50"
      disabled={!sellerMessage.trim()}
    >
      {t.confirm ?? "Confirm"}
    </button>
  </div>
)}
            

            {/* CANCEL */}
            {showCancelFor === o.id && (
  <div className="bg-white p-4 rounded-xl border mt-2 shadow-sm space-y-4">

    {/* TITLE */}
    <p className="text-sm font-medium">
      {t.cancel_order ?? "Cancel order"}
    </p>

    {/* REASONS */}
    <div className="space-y-2">
      {SELLER_CANCEL_REASONS.map((r) => (
        <label key={r} className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            value={r}
            checked={selectedReason === r}
            onChange={(e) => setSelectedReason(e.target.value)}
          />
          {r}
        </label>
      ))}
    </div>

    {/* CUSTOM */}
    {selectedReason === (t.cancel_reason_other ?? "Other") && (
      <input
        value={customReason}
        onChange={(e) => setCustomReason(e.target.value)}
        placeholder={t.enter_reason ?? "Enter reason"}
        className="w-full border rounded-lg p-2 text-sm"
      />
    )}

    {/* ✅ ACTION BUTTONS */}
    <div className="flex gap-2">

      {/* CANCEL BUTTON */}
      <button
        onClick={() => setShowCancelFor(null)}
        className="flex-1 py-2 border rounded-lg active:scale-95"
      >
        {t.close ?? "Cancel"}
      </button>

      {/* OK BUTTON */}
      <button
        onClick={() => handleCancel(o.id)}
        className="flex-1 py-2 bg-red-500 text-white rounded-lg active:scale-95"
      >
        {t.ok ?? "OK"}
      </button>

    </div>

  </div>
)}

            {/* SHIPPING */}
            {confirmShippingId === o.id && (
              <div className="bg-white p-3 rounded border mt-2">
                <p>Confirm shipping?</p>

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setConfirmShippingId(null)}
                    className="flex-1 border rounded"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={() => handleShipping(o.id)}
                    className="flex-1 bg-gray-800 text-white rounded"
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      />
    </main>
  );
}

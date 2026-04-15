"use client";

export const dynamic = "force-dynamic";
import useSWR from "swr";
import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { getPiAccessToken } from "@/lib/piAuth";
import { formatPi } from "@/lib/pi";

/* ================= TYPES ================= */
interface OrderItem {
  product_name: string;
  thumbnail: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: string;
}

interface Order {
  id: string;
  order_number: string;
  total: number;
  created_at: string;
  status: string;

  shipping_name: string;
  shipping_phone: string;
  shipping_address_line: string;
  shipping_ward?: string | null;
  shipping_district?: string | null;
  shipping_region?: string | null;
  shipping_country?: string | null;
  shipping_postal_code?: string | null;

  order_items: OrderItem[];
}

interface MessageState {
  type: "error" | "success";
  text: string;
}

/* ================= CANCEL KEYS (GIỮ NGUYÊN) ================= */

const CANCEL_REASON_KEYS = [
  "cancel_reason_change_mind",
  "cancel_reason_wrong_product",
  "cancel_reason_change_variant",
  "cancel_reason_better_price",
  "cancel_reason_delivery_slow",
  "cancel_reason_update_address",
  "cancel_reason_other",
] as const;

/* ================= FETCHER ================= */

const fetcher = async (url: string): Promise<Order[]> => {
  try {
    const token = await getPiAccessToken();
    if (!token) return [];

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) return [];

    const data = await res.json();

    // 🔥 FIX QUAN TRỌNG
    const list = Array.isArray(data) ? data : data.orders;

    if (!Array.isArray(list)) return [];

    return list.map((o: any) => ({
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      total: Number(o.total ?? 0),
      created_at: o.created_at,

      shipping_name: o.shipping_name ?? "",
      shipping_phone: o.shipping_phone ?? "",

      shipping_address_line: o.shipping_address_line ?? "",
      shipping_ward: o.shipping_ward ?? null,
      shipping_district: o.shipping_district ?? null,
      shipping_region: o.shipping_region ?? null,

      shipping_country: o.shipping_country ?? null,
      shipping_postal_code: o.shipping_postal_code ?? null,

      order_items: (o.order_items || []).map((i: any) => ({
        product_name: i.product_name ?? "",
        thumbnail: i.thumbnail ?? "",
        quantity: Number(i.quantity ?? 0),
        unit_price: Number(i.unit_price ?? 0),
        total_price: Number(i.total_price ?? 0),
        status: i.status ?? "pending",
      })),
    }));
  } catch (err) {
    console.error("FETCH ERROR", err);
    return [];
  }
};
/* ================= PAGE ================= */

export default function PendingOrdersPage() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showCancelFor, setShowCancelFor] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [message, setMessage] = useState<MessageState | null>(null);

  function showMessage(text: string, type: "error" | "success" = "error") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }

  function resetCancelState() {
    setShowCancelFor(null);
    setSelectedReason("");
    setCustomReason("");
  }

  /* ================= SWR ================= */

  const {
    data: allOrders = [],
    isLoading,
    mutate,
  } = useSWR(user ? "/api/orders" : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
    keepPreviousData: true,
  });

  const orders = useMemo(
    () => allOrders.filter((o: Order) => o.status === "pending"),
    [allOrders]
  );

  const totalPi = useMemo(
    () => orders.reduce((sum, o) => sum + Number(o.total || 0), 0),
    [orders]
  );

  /* ================= CANCEL ================= */

  async function handleCancel(orderId: string, reason: string) {
    try {
      setProcessingId(orderId);

      const token = await getPiAccessToken();

      if (!token) {
        showMessage(t.login_required || "Vui lòng đăng nhập", "error");
        return;
      }

      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cancel_reason: reason }),
      });

      if (!res.ok) throw new Error("CANCEL_FAILED");

      // ✅ update UI ngay
      mutate(
        (prev: Order[] = []) =>
          prev.filter((o) => o.id !== orderId),
        false
      );

      resetCancelState();

      showMessage(
        t.cancel_success || "Huỷ đơn thành công",
        "success"
      );

    } catch (err) {
      console.error(err);

      showMessage(
        t.cancel_order_failed || "Không thể huỷ đơn.",
        "error"
      );

    } finally {
      setProcessingId(null);
    }
  }

  /* ================= UI ================= */

  if (authLoading) {
    return (
      <main className="p-8 text-center">
        {t.loading || "Loading..."}
      </main>
    );
  }

  if (!user) {
    return (
      <main className="p-8 text-center">
        {t.login_required || "Please login"}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* MESSAGE */}
      {message && (
        <div
          className={`fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm text-white shadow-lg ${
            message.type === "error" ? "bg-red-500" : "bg-green-500"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* HEADER */}
      <header className="bg-orange-500 px-4 py-4 text-white">
        <div className="rounded-lg bg-orange-400 p-4">
          <p className="text-sm opacity-90">
            {t.order_info}
          </p>

          <p className="mt-1 text-xs opacity-80">
            {t.orders}: {orders.length} · π{formatPi(totalPi)}
          </p>
        </div>
      </header>

      {/* CONTENT */}
      <section className="mt-6 px-4">

        {isLoading ? (
          <p className="text-center text-gray-400">
            {t.loading_orders || "Đang tải..."}
          </p>

        ) : orders.length === 0 ? (
          <div className="mt-16 flex flex-col items-center justify-center text-gray-400">
            <div className="mb-4 h-24 w-24 rounded-full bg-gray-200 opacity-40" />
            <p>
              {t.no_pending_orders || "Không có đơn chờ xác nhận"}
            </p>
          </div>

        ) : (
          <div className="space-y-4">

            {orders.map((o) => (
              <div key={o.id} className="bg-white rounded-xl shadow-sm">

                {/* HEADER */}
                <div className="flex justify-between px-4 py-3 border-b">
                  <span className="text-sm font-semibold">
                    #{o.order_number}
                  </span>

                  <span className="text-orange-500 text-sm">
                    {t.status_pending || "Chờ xác nhận"}
                  </span>
                </div>

                {/* PRODUCTS */}
                <div className="space-y-3 px-4 py-3">
  {o.order_items?.map((item, idx) => (
    <div key={idx} className="flex gap-3">

      <img
        src={item.thumbnail || "/placeholder.png"}
        className="w-16 h-16 rounded object-cover border"
      />

      <div className="flex-1">
        <p className="text-sm font-medium line-clamp-2">
          {item.product_name}
        </p>

        <p className="text-xs text-gray-500 mt-1">
          x{item.quantity} · π{formatPi(item.unit_price)}
        </p>

        <p className="text-xs mt-1">
          Status:{" "}
          <span className="font-medium text-orange-600">
            {item.status}
          </span>
        </p>
      </div>

    </div>
  ))}
</div>

                {/* FOOTER */}
                <div className="flex justify-between px-4 py-3 border-t">
                  <span className="text-sm font-semibold">
                    {t.total}: π{formatPi(o.total)}
                  </span>

                  <button
                    onClick={() => setShowCancelFor(o.id)}
                    disabled={processingId === o.id}
                    className="border border-red-500 text-red-500 px-3 py-1 rounded disabled:opacity-50"
                  >
                    {processingId === o.id
                      ? t.canceling || "Đang huỷ..."
                      : t.cancel_order}
                  </button>
                </div>

                {/* CANCEL BOX */}
                {showCancelFor === o.id && (
                  <div className="p-4 space-y-3">

                    {CANCEL_REASON_KEYS.map((key) => (
                      <label key={key} className="flex gap-2 text-sm">
                        <input
                          type="radio"
                          checked={selectedReason === key}
                          onChange={() => setSelectedReason(key)}
                        />
                        {t[key] || key}
                      </label>
                    ))}

                    {selectedReason === "cancel_reason_other" && (
                      <textarea
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder={t.enter_cancel_reason}
                        className="w-full border p-2 rounded"
                      />
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const reason =
                            selectedReason === "cancel_reason_other"
                              ? customReason
                              : selectedReason;

                          if (!reason) {
                            showMessage(
                              t.select_cancel_reason,
                              "error"
                            );
                            return;
                          }

                          handleCancel(o.id, reason);
                        }}
                        className="bg-red-500 text-white px-4 py-2 rounded"
                      >
                        {t.confirm_cancel}
                      </button>

                      <button
                        onClick={resetCancelState}
                        className="border px-4 py-2 rounded"
                      >
                        {t.cancel}
                      </button>
                    </div>

                  </div>
                )}

              </div>
            ))}

          </div>
        )}

      </section>
    </main>
  );
} mới nhưng vẫn không hiển thị đơn hàng .

"use client";

export const dynamic = "force-dynamic";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { getPiAccessToken } from "@/lib/piAuth";
import { formatPi } from "@/lib/pi";

/* ================= TYPES ================= */

interface OrderItem {
  product_name: string;
  thumbnail: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: string;
}

interface Order {
  id: string;
  order_number: string;
  total: number;
  created_at: string;
  status: string;

  shipping_name: string;
  shipping_phone: string;
  shipping_address_line: string;
  shipping_ward?: string | null;
  shipping_district?: string | null;
  shipping_region?: string | null;
  shipping_country?: string | null;
  shipping_postal_code?: string | null;

  order_items: OrderItem[];
}

interface MessageState {
  type: "error" | "success";
  text: string;
}

/* ================= CANCEL KEYS (GIỮ NGUYÊN) ================= */

const CANCEL_REASON_KEYS = [
  "cancel_reason_change_mind",
  "cancel_reason_wrong_product",
  "cancel_reason_change_variant",
  "cancel_reason_better_price",
  "cancel_reason_delivery_slow",
  "cancel_reason_update_address",
  "cancel_reason_other",
] as const;

/* ================= FETCHER ================= */

const fetcher = async (url: string): Promise<Order[]> => {
  try {
    const token = await getPiAccessToken();
    if (!token) return [];

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) return [];

    const data = await res.json();

    if (!Array.isArray(data)) return [];

    return data.map((o: any) => ({
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      total: Number(o.total ?? 0),
      created_at: o.created_at,

      shipping_name: o.shipping_name ?? "",
      shipping_phone: o.shipping_phone ?? "",

      shipping_address_line: o.shipping_address_line ?? "",
      shipping_ward: o.shipping_ward ?? null,
      shipping_district: o.shipping_district ?? null,
      shipping_region: o.shipping_region ?? null,

      shipping_country: o.shipping_country ?? null,
      shipping_postal_code: o.shipping_postal_code ?? null,

      order_items: (o.order_items || []).map((i: any) => ({
        product_name: i.product_name ?? "",
        thumbnail: i.thumbnail ?? "",
        quantity: Number(i.quantity ?? 0),
        unit_price: Number(i.unit_price ?? 0),
        total_price: Number(i.total_price ?? 0),
        status: i.status ?? "pending",
      })),
    }));
  } catch (err) {
    console.error("FETCH ERROR", err);
    return [];
  }
};

/* ================= PAGE ================= */

export default function PendingOrdersPage() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showCancelFor, setShowCancelFor] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [message, setMessage] = useState<MessageState | null>(null);

  function showMessage(text: string, type: "error" | "success" = "error") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }

  function resetCancelState() {
    setShowCancelFor(null);
    setSelectedReason("");
    setCustomReason("");
  }

  /* ================= SWR ================= */

  const {
    data: allOrders = [],
    isLoading,
    mutate,
  } = useSWR(user ? "/api/orders" : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
    keepPreviousData: true,
  });

  const orders = useMemo(
    () => allOrders.filter((o: Order) => o.status === "pending"),
    [allOrders]
  );

  const totalPi = useMemo(
    () => orders.reduce((sum, o) => sum + Number(o.total || 0), 0),
    [orders]
  );

  /* ================= CANCEL ================= */

  async function handleCancel(orderId: string, reason: string) {
    try {
      setProcessingId(orderId);

      const token = await getPiAccessToken();

      if (!token) {
        showMessage(t.login_required || "Vui lòng đăng nhập", "error");
        return;
      }

      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cancel_reason: reason }),
      });

      if (!res.ok) throw new Error("CANCEL_FAILED");

      // ✅ update UI ngay
      mutate(
        (prev: Order[] = []) =>
          prev.filter((o) => o.id !== orderId),
        false
      );

      resetCancelState();

      showMessage(
        t.cancel_success || "Huỷ đơn thành công",
        "success"
      );

    } catch (err) {
      console.error(err);

      showMessage(
        t.cancel_order_failed || "Không thể huỷ đơn.",
        "error"
      );

    } finally {
      setProcessingId(null);
    }
  }

  /* ================= UI ================= */

  if (authLoading) {
    return (
      <main className="p-8 text-center">
        {t.loading || "Loading..."}
      </main>
    );
  }

  if (!user) {
    return (
      <main className="p-8 text-center">
        {t.login_required || "Please login"}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* MESSAGE */}
      {message && (
        <div
          className={`fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm text-white shadow-lg ${
            message.type === "error" ? "bg-red-500" : "bg-green-500"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* HEADER */}
      <header className="bg-orange-500 px-4 py-4 text-white">
        <div className="rounded-lg bg-orange-400 p-4">
          <p className="text-sm opacity-90">
            {t.order_info}
          </p>

          <p className="mt-1 text-xs opacity-80">
            {t.orders}: {orders.length} · π{formatPi(totalPi)}
          </p>
        </div>
      </header>

      {/* CONTENT */}
      <section className="mt-6 px-4">

        {isLoading ? (
          <p className="text-center text-gray-400">
            {t.loading_orders || "Đang tải..."}
          </p>

        ) : orders.length === 0 ? (
          <div className="mt-16 flex flex-col items-center justify-center text-gray-400">
            <div className="mb-4 h-24 w-24 rounded-full bg-gray-200 opacity-40" />
            <p>
              {t.no_pending_orders || "Không có đơn chờ xác nhận"}
            </p>
          </div>

        ) : (
          <div className="space-y-4">

            {orders.map((o) => (
              <div key={o.id} className="bg-white rounded-xl shadow-sm">

                {/* HEADER */}
                <div className="flex justify-between px-4 py-3 border-b">
                  <span className="text-sm font-semibold">
                    #{o.order_number}
                  </span>

                  <span className="text-orange-500 text-sm">
                    {t.status_pending || "Chờ xác nhận"}
                  </span>
                </div>
                {/* SHIPPING */}
<div className="px-4 py-3 border-b text-sm space-y-1">
  <p>
    <span className="text-gray-500">Receiver:</span>{" "}
    {o.shipping_name}
  </p>

  <p>
    <span className="text-gray-500">Phone:</span>{" "}
    {o.shipping_phone}
  </p>

  <p className="text-xs text-gray-600">
    {[
      o.shipping_address_line,
      o.shipping_ward,
      o.shipping_district,
      o.shipping_region,
    ]
      .filter(Boolean)
      .join(", ")}
  </p>

  {(o.shipping_country || o.shipping_postal_code) && (
    <p className="text-xs text-gray-500">
      {o.shipping_country && <span>{o.shipping_country}</span>}
      {o.shipping_postal_code && (
        <span> · {o.shipping_postal_code}</span>
      )}
    </p>
  )}
</div>

                {/* PRODUCTS */}
                <div className="space-y-3 px-4 py-3">
                  {o.order_items?.map((item, idx) => (
                    <div key={idx} className="flex gap-3">

                      <img
                        src={item.thumbnail || "/placeholder.png"}
                        className="w-14 h-14 rounded object-cover"
                      />

                      <div className="flex-1">
                        <p className="text-sm line-clamp-1">
                          {item.product_name}
                        </p>

                        <p className="text-xs text-gray-500">
                          x{item.quantity} · π{formatPi(item.unit_price)}
                        </p>
                        <p className="text-xs mt-1">
                      Status:{" "}
                <span className="font-medium text-orange-600">
               {item.status}
              </span>
                </p>
                      </div>

                    </div>
                  ))}
                </div>

                {/* FOOTER */}
                <div className="flex justify-between px-4 py-3 border-t">
                  <span className="text-sm font-semibold">
                    {t.total}: π{formatPi(o.total)}
                  </span>

                  <button
                    onClick={() => setShowCancelFor(o.id)}
                    disabled={processingId === o.id}
                    className="border border-red-500 text-red-500 px-3 py-1 rounded disabled:opacity-50"
                  >
                    {processingId === o.id
                      ? t.canceling || "Đang huỷ..."
                      : t.cancel_order}
                  </button>
                </div>

                {/* CANCEL BOX */}
                {showCancelFor === o.id && (
                  <div className="p-4 space-y-3">

                    {CANCEL_REASON_KEYS.map((key) => (
                      <label key={key} className="flex gap-2 text-sm">
                        <input
                          type="radio"
                          checked={selectedReason === key}
                          onChange={() => setSelectedReason(key)}
                        />
                        {t[key] || key}
                      </label>
                    ))}

                    {selectedReason === "cancel_reason_other" && (
                      <textarea
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder={t.enter_cancel_reason}
                        className="w-full border p-2 rounded"
                      />
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const reason =
                            selectedReason === "cancel_reason_other"
                              ? customReason
                              : selectedReason;

                          if (!reason) {
                            showMessage(
                              t.select_cancel_reason,
                              "error"
                            );
                            return;
                          }

                          handleCancel(o.id, reason);
                        }}
                        className="bg-red-500 text-white px-4 py-2 rounded"
                      >
                        {t.confirm_cancel}
                      </button>

                      <button
                        onClick={resetCancelState}
                        className="border px-4 py-2 rounded"
                      >
                        {t.cancel}
                      </button>
                    </div>

                  </div>
                )}

              </div>
            ))}

          </div>
        )}

      </section>
    </main>
  );
}

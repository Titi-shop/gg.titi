"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { formatPi } from "@/lib/pi";

import OrderFilterBar from "@/components/OrderFilterBar";
import OrdersList from "@/components/OrdersList";
import OrderActions from "@/components/OrderActions";

/* ======================================================
   TYPES
====================================================== */

type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipping"
  | "completed"
  | "returned"
  | "cancelled";

type TabType = OrderStatus | "all";

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

/* ======================================================
   FETCHER
====================================================== */

const fetcher = async (): Promise<Order[]> => {
  const res = await apiAuthFetch("/api/seller/orders", {
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data: unknown = await res.json();

  if (!Array.isArray(data)) return [];

  return data.map((row) => {
    const o = row as RawOrder;

    const itemStatuses = (o.order_items ?? []).map((item) =>
      String(item.status ?? "").toLowerCase().trim()
    );

    let status: OrderStatus = "pending";

    if (itemStatuses.includes("shipping")) {
      status = "shipping";
    } else if (itemStatuses.includes("completed")) {
      status = "completed";
    } else if (itemStatuses.includes("returned")) {
      status = "returned";
    } else if (itemStatuses.includes("confirmed")) {
      status = "confirmed";
    } else if (itemStatuses.includes("cancelled")) {
      status = "cancelled";
    }

    return {
      id: o.id,
      order_number: o.order_number,
      status,
      total: Number(o.total ?? 0),
      created_at: o.created_at,
      shipping_name: o.shipping_name ?? "",
      shipping_phone: o.shipping_phone ?? "",
      order_items: (o.order_items ?? []).map((item) => ({
        id: item.id,
        product_name: item.product_name ?? "",
        thumbnail: item.thumbnail ?? "",
        quantity: Number(item.quantity ?? 0),
        unit_price: Number(item.unit_price ?? 0),
      })),
    };
  });
};

/* ======================================================
   PAGE
====================================================== */

export default function SellerOrdersPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const {
    data: orders = [],
    isLoading,
    mutate,
  } = useSWR(
    !authLoading && user ? "/api/seller/orders" : null,
    fetcher
  );

  /* ======================================================
     STATE
  ====================================================== */

  const [currentTab, setCurrentTab] =
    useState<TabType>("pending");

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [showConfirmFor, setShowConfirmFor] =
    useState<string | null>(null);

  const [showCancelFor, setShowCancelFor] =
    useState<string | null>(null);

  const [confirmShippingId, setConfirmShippingId] =
    useState<string | null>(null);

  const [sellerMessage, setSellerMessage] =
    useState("");

  const [selectedReason, setSelectedReason] =
    useState("");

  const [customReason, setCustomReason] =
    useState("");

  /* ======================================================
     CANCEL REASONS
  ====================================================== */

  const sellerCancelReasons = [
    t.cancel_reason_out_of_stock ??
      "Out of stock",
    t.cancel_reason_discontinued ??
      "Discontinued",
    t.cancel_reason_wrong_price ??
      "Wrong price",
    t.cancel_reason_other ??
      "Other",
  ];

  /* ======================================================
     FILTERED LIST
  ====================================================== */

  const tabOrders = useMemo(() => {
    if (currentTab === "all") {
      return orders;
    }

    return orders.filter(
      (order) => order.status === currentTab
    );
  }, [orders, currentTab]);

  /* ======================================================
     TOTAL
  ====================================================== */

  const headerTotal = useMemo(() => {
    return tabOrders.reduce(
      (sum, order) => sum + order.total,
      0
    );
  }, [tabOrders]);

  /* ======================================================
     ACTIONS
  ====================================================== */

  async function handleConfirm(
    orderId: string
  ) {
    if (!sellerMessage.trim()) return;

    try {
      setProcessingId(orderId);

      await apiAuthFetch(
        `/api/seller/orders/${orderId}/confirm`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            seller_message:
              sellerMessage.trim(),
          }),
        }
      );

      setShowConfirmFor(null);
      setSellerMessage("");

      await mutate();
    } finally {
      setProcessingId(null);
    }
  }

  async function handleCancel(
    orderId: string
  ) {
    const otherText =
      t.cancel_reason_other ??
      "Other";

    const reason =
      selectedReason === otherText
        ? customReason.trim()
        : selectedReason.trim();

    if (!reason) {
      alert(
        t.select_reason ??
          "Please select reason"
      );
      return;
    }

    try {
      setProcessingId(orderId);

      await apiAuthFetch(
        `/api/seller/orders/${orderId}/cancel`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            cancel_reason: reason,
          }),
        }
      );

      setShowCancelFor(null);
      setSelectedReason("");
      setCustomReason("");

      await mutate();
    } finally {
      setProcessingId(null);
    }
  }

  async function handleShipping(
    orderId: string
  ) {
    try {
      setProcessingId(orderId);

      await apiAuthFetch(
        `/api/seller/orders/${orderId}/shipping`,
        {
          method: "PATCH",
        }
      );

      setConfirmShippingId(null);

      await mutate();
    } finally {
      setProcessingId(null);
    }
  }

  /* ======================================================
     LOADING
  ====================================================== */

  if (authLoading || isLoading) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 space-y-4">
        {Array.from({ length: 5 }).map(
          (_, i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-white animate-pulse"
            />
          )
        )}
      </main>
    );
  }

  /* ======================================================
     LABEL
  ====================================================== */

  const titleMap: Record<TabType, string> =
    {
      all:
        t.all_orders ??
        "All Orders",
      pending:
        t.pending_orders ??
        "Pending",
      confirmed:
        t.confirmed_orders ??
        "Confirmed",
      shipping:
        t.shipping_orders ??
        "Shipping",
      completed:
        t.completed_orders ??
        "Completed",
      returned:
        t.returned_orders ??
        "Returned",
      cancelled:
        t.cancelled_orders ??
        "Cancelled",
    };

  /* ======================================================
     UI
  ====================================================== */

  return (
    <main className="min-h-screen bg-gray-100 pb-28">
      {/* HEADER */}
      <header className="bg-gray-700 text-white px-4 py-4 shadow">
        <div className="bg-gray-600 rounded-2xl p-4">
          <p className="text-sm font-medium">
            {titleMap[currentTab]}
          </p>

          <p className="text-xs mt-1 opacity-90">
            {tabOrders.length} · π
            {formatPi(headerTotal)}
          </p>
        </div>
      </header>

      {/* SEARCH / FILTER */}
      <OrderFilterBar
        orders={orders}
        onFiltered={() => {
          /* giữ nguyên component cũ */
        }}
      />

      {/* LIST */}
      <OrdersList
        orders={tabOrders}
        initialTab={currentTab}
        onTabChange={(tab) =>
          setCurrentTab(tab as TabType)
        }
        onClick={() => {}}
        renderActions={(order) => (
          <OrderActions
            status={order.status}
            loading={
              processingId === order.id
            }
            onDetail={() =>
              router.push(
                `/seller/orders/${order.id}`
              )
            }
            onConfirm={() => {
              setSellerMessage(
                t.order_thank_you_message ??
                  "Thank you for your order ❤️"
              );

              setShowConfirmFor(
                order.id
              );
              setShowCancelFor(
                null
              );
            }}
            onCancel={() => {
              setSelectedReason(
                ""
              );
              setCustomReason(
                ""
              );

              setShowCancelFor(
                order.id
              );
              setShowConfirmFor(
                null
              );
            }}
            onShipping={() =>
              setConfirmShippingId(
                order.id
              )
            }
          />
        )}
        renderExtra={(order) => (
          <>
            {/* CONFIRM */}
            {showConfirmFor ===
              order.id && (
              <div className="bg-white border rounded-2xl p-4 mt-3 space-y-4 shadow-sm">
                <p className="text-sm font-medium">
                  {t.confirm_order ??
                    "Confirm order"}
                </p>

                <div className="flex flex-wrap gap-2">
                  {[
                    t.quick_thank_you ??
                      "Thank you ❤️",
                    t.quick_ship_soon ??
                      "We will ship soon 🚚",
                    t.quick_have_nice_day ??
                      "Have a nice day 🌟",
                  ].map((msg) => (
                    <button
                      key={msg}
                      type="button"
                      onClick={() =>
                        setSellerMessage(
                          msg
                        )
                      }
                      className="px-3 py-1.5 text-xs rounded-lg border active:scale-95"
                    >
                      {msg}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  value={
                    sellerMessage
                  }
                  onChange={(e) =>
                    setSellerMessage(
                      e.target.value
                    )
                  }
                  className="w-full border rounded-xl p-3 text-sm"
                  placeholder={
                    t.enter_message ??
                    "Enter message"
                  }
                />

                <button
                  type="button"
                  disabled={
                    !sellerMessage.trim()
                  }
                  onClick={() =>
                    handleConfirm(
                      order.id
                    )
                  }
                  className="w-full py-3 rounded-xl bg-green-600 text-white disabled:opacity-50"
                >
                  {t.confirm ??
                    "Confirm"}
                </button>
              </div>
            )}

            {/* CANCEL */}
            {showCancelFor ===
              order.id && (
              <div className="bg-white border rounded-2xl p-4 mt-3 space-y-4 shadow-sm">
                <p className="text-sm font-medium">
                  {t.cancel_order ??
                    "Cancel order"}
                </p>

                <div className="space-y-2">
                  {sellerCancelReasons.map(
                    (reason) => (
                      <label
                        key={
                          reason
                        }
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="radio"
                          checked={
                            selectedReason ===
                            reason
                          }
                          onChange={() =>
                            setSelectedReason(
                              reason
                            )
                          }
                        />
                        {reason}
                      </label>
                    )
                  )}
                </div>

                {selectedReason ===
                  (t.cancel_reason_other ??
                    "Other") && (
                  <input
                    value={
                      customReason
                    }
                    onChange={(
                      e
                    ) =>
                      setCustomReason(
                        e.target.value
                      )
                    }
                    className="w-full border rounded-xl p-3 text-sm"
                    placeholder={
                      t.enter_reason ??
                      "Enter reason"
                    }
                  />
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setShowCancelFor(
                        null
                      )
                    }
                    className="py-3 border rounded-xl"
                  >
                    {t.close ??
                      "Close"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleCancel(
                        order.id
                      )
                    }
                    className="py-3 rounded-xl bg-red-500 text-white"
                  >
                    {t.ok ?? "OK"}
                  </button>
                </div>
              </div>
            )}

            {/* SHIPPING */}
            {confirmShippingId ===
              order.id && (
              <div className="bg-white border rounded-2xl p-4 mt-3 shadow-sm">
                <p className="text-sm font-medium">
                  {t.confirm_shipping ??
                    "Confirm shipping?"}
                </p>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmShippingId(
                        null
                      )
                    }
                    className="py-3 border rounded-xl"
                  >
                    {t.cancel ??
                      "Cancel"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleShipping(
                        order.id
                      )
                    }
                    className="py-3 rounded-xl bg-gray-800 text-white"
                  >
                    {t.ok ?? "OK"}
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

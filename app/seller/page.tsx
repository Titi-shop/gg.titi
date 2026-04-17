"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import useSWR from "swr";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

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

type OrderTab = "all" | OrderStatus;

type RawOrderItem = {
  id?: string;
  product_name?: string;
  thumbnail?: string;
  quantity?: number | string;
  unit_price?: number | string;
  status?: string;
};

type RawOrder = {
  id?: string;
  order_number?: string;
  total?: number | string;
  created_at?: string;
  shipping_name?: string;
  shipping_phone?: string;
  order_items?: RawOrderItem[];
};

type OrderItem = {
  id: string;
  product_name: string;
  thumbnail: string;
  quantity: number;
  unit_price: number;
};

type Order = {
  id: string;
  order_number: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  shipping_name: string;
  shipping_phone: string;
  order_items: OrderItem[];
};

/* ======================================================
   HELPERS
====================================================== */

function normalizeStatus(
  value: string
): OrderStatus {
  const v = value
    .toLowerCase()
    .trim();

  if (
    v === "pending" ||
    v === "confirmed" ||
    v === "shipping" ||
    v === "completed" ||
    v === "returned" ||
    v === "cancelled"
  ) {
    return v;
  }

  return "pending";
}

function getOrderStatus(
  items: RawOrderItem[]
): OrderStatus {
  const statuses = items.map((i) =>
    normalizeStatus(
      String(i.status ?? "")
    )
  );

  if (
    statuses.includes("shipping")
  )
    return "shipping";

  if (
    statuses.includes("completed")
  )
    return "completed";

  if (
    statuses.includes("returned")
  )
    return "returned";

  if (
    statuses.includes("confirmed")
  )
    return "confirmed";

  if (
    statuses.includes("cancelled")
  )
    return "cancelled";

  return "pending";
}

function showError(
  res: Response
): Promise<void> {
  if (res.ok) return Promise.resolve();
  throw new Error("REQUEST_FAILED");
}

/* ======================================================
   FETCHER
====================================================== */

const fetcher = async (): Promise<
  Order[]
> => {
  const res =
    await apiAuthFetch(
      "/api/seller/orders",
      {
        cache: "no-store",
      }
    );

  if (!res.ok) return [];

  const data =
    (await res.json()) as unknown;

  if (!Array.isArray(data))
    return [];

  return data.map(
    (raw: RawOrder): Order => {
      const items =
        raw.order_items ?? [];

      return {
        id: String(raw.id ?? ""),
        order_number: String(
          raw.order_number ?? ""
        ),
        status:
          getOrderStatus(items),
        total: Number(
          raw.total ?? 0
        ),
        created_at: String(
          raw.created_at ?? ""
        ),
        shipping_name: String(
          raw.shipping_name ??
            ""
        ),
        shipping_phone: String(
          raw.shipping_phone ??
            ""
        ),
        order_items:
          items.map((i) => ({
            id: String(
              i.id ?? ""
            ),
            product_name:
              String(
                i.product_name ??
                  ""
              ),
            thumbnail:
              String(
                i.thumbnail ??
                  ""
              ),
            quantity: Number(
              i.quantity ?? 0
            ),
            unit_price:
              Number(
                i.unit_price ??
                  0
              ),
          })),
      };
    }
  );
};

/* ======================================================
   PAGE
====================================================== */

export default function SellerOrdersPage() {
  const router = useRouter();
  const searchParams =
    useSearchParams();

  const { t } =
    useTranslation();

  const {
    user,
    loading:
      authLoading,
  } = useAuth();

  const tabFromUrl =
    (searchParams.get(
      "tab"
    ) as OrderTab) ||
    "pending";

  const {
    data: orders = [],
    isLoading,
    mutate,
  } = useSWR(
    !authLoading && user
      ? "/api/seller/orders"
      : null,
    fetcher
  );

  /* ================= STATE ================= */

  const [
    currentTab,
    setCurrentTab,
  ] =
    useState<OrderTab>(
      tabFromUrl
    );

  const [
    filteredOrders,
    setFilteredOrders,
  ] = useState<Order[]>(
    []
  );

  const [
    processingId,
    setProcessingId,
  ] = useState<
    string | null
  >(null);

  const [
    showConfirmFor,
    setShowConfirmFor,
  ] = useState<
    string | null
  >(null);

  const [
    showCancelFor,
    setShowCancelFor,
  ] = useState<
    string | null
  >(null);

  const [
    confirmShippingId,
    setConfirmShippingId,
  ] = useState<
    string | null
  >(null);

  const [
    sellerMessage,
    setSellerMessage,
  ] = useState("");

  const [
    selectedReason,
    setSelectedReason,
  ] = useState("");

  const [
    customReason,
    setCustomReason,
  ] = useState("");

  const [
    toast,
    setToast,
  ] = useState("");

  /* ================= URL TAB ================= */

  useEffect(() => {
    setCurrentTab(
      tabFromUrl
    );
  }, [tabFromUrl]);

  /* ================= TOAST ================= */

  function showToast(
    text: string
  ) {
    setToast(text);

    window.setTimeout(() => {
      setToast("");
    }, 2200);
  }

  /* ================= REASONS ================= */

  const cancelReasons =
    useMemo(
      () => [
        t.cancel_reason_out_of_stock ??
          "Out of stock",
        t.cancel_reason_discontinued ??
          "Discontinued",
        t.cancel_reason_wrong_price ??
          "Wrong price",
        t.cancel_reason_other ??
          "Other",
      ],
      [t]
    );

  /* ================= FILTER ================= */

  const baseOrders =
    filteredOrders.length >
      0 ||
    filteredOrders.length ===
      orders.length
      ? filteredOrders
      : orders;

  const visibleOrders =
    useMemo(() => {
      if (
        currentTab === "all"
      )
        return baseOrders;

      return baseOrders.filter(
        (o) =>
          o.status ===
          currentTab
      );
    }, [
      baseOrders,
      currentTab,
    ]);

  const headerTotal =
    useMemo(
      () =>
        visibleOrders.reduce(
          (
            sum,
            o
          ) =>
            sum +
            o.total,
          0
        ),
      [visibleOrders]
    );

  /* ======================================================
     ACTIONS
  ====================================================== */

  async function handleConfirm(
    id: string
  ) {
    if (
      !sellerMessage.trim()
    )
      return;

    try {
      setProcessingId(id);

      const res =
        await apiAuthFetch(
          `/api/seller/orders/${id}/confirm`,
          {
            method:
              "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              {
                seller_message:
                  sellerMessage.trim(),
              }
            ),
          }
        );

      await showError(
        res
      );

      setShowConfirmFor(
        null
      );
      setSellerMessage(
        ""
      );

      await mutate();

      showToast(
        t.confirm_success ??
          "Confirmed"
      );
    } catch {
      showToast(
        t.action_failed ??
          "Failed"
      );
    } finally {
      setProcessingId(
        null
      );
    }
  }

  async function handleCancel(
    id: string
  ) {
    const reason =
      selectedReason ===
      (t.cancel_reason_other ??
        "Other")
        ? customReason.trim()
        : selectedReason.trim();

    if (!reason) {
      showToast(
        t.select_reason ??
          "Select reason"
      );
      return;
    }

    try {
      setProcessingId(id);

      const res =
        await apiAuthFetch(
          `/api/seller/orders/${id}/cancel`,
          {
            method:
              "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              {
                cancel_reason:
                  reason,
              }
            ),
          }
        );

      await showError(
        res
      );

      setShowCancelFor(
        null
      );
      setSelectedReason(
        ""
      );
      setCustomReason(
        ""
      );

      await mutate();

      showToast(
        t.cancel_success ??
          "Cancelled"
      );
    } catch {
      showToast(
        t.action_failed ??
          "Failed"
      );
    } finally {
      setProcessingId(
        null
      );
    }
  }

  async function handleShipping(
    id: string
  ) {
    try {
      setProcessingId(id);

      const res =
        await apiAuthFetch(
          `/api/seller/orders/${id}/shipping`,
          {
            method:
              "PATCH",
          }
        );

      await showError(
        res
      );

      setConfirmShippingId(
        null
      );

      await mutate();

      showToast(
        t.shipping_started ??
          "Shipping started"
      );
    } catch {
      showToast(
        t.action_failed ??
          "Failed"
      );
    } finally {
      setProcessingId(
        null
      );
    }
  }

  /* ======================================================
     LOADING
  ====================================================== */

  if (
    authLoading ||
    isLoading
  ) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 space-y-4">
        {Array.from({
          length: 4,
        }).map(
          (_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-white animate-pulse"
            />
          )
        )}
      </main>
    );
  }

  /* ======================================================
     UI
  ====================================================== */

  return (
    <main className="min-h-screen bg-gray-100 pb-32">
      {/* TOAST */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-sm px-4 py-2 rounded-full shadow-xl">
          {toast}
        </div>
      )}

      {/* HEADER */}
      <header className="bg-gray-700 text-white px-4 py-4 shadow">
        <div className="bg-gray-600 rounded-2xl p-4">
          <p className="text-sm">
            {
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
              }[
                currentTab
              ]
            }
          </p>

          <p className="text-xs mt-1">
            {
              visibleOrders.length
            }{" "}
            · π
            {formatPi(
              headerTotal
            )}
          </p>
        </div>
      </header>

      {/* FILTER */}
      <OrderFilterBar
        orders={orders}
        onFiltered={
          setFilteredOrders
        }
      />

      {/* LIST */}
      <OrdersList
        orders={baseOrders}
        onClick={(id) =>
          router.push(
            `/seller/orders/${id}`
          )
        }
        initialTab={
          currentTab
        }
        onTabChange={(
          tab
        ) =>
          setCurrentTab(
            tab
          )
        }
        renderActions={(
          order
        ) => (
          <OrderActions
            orderId={
              order.id
            }
            status={
              order.status
            }
            loading={
              processingId ===
              order.id
            }
            onDetail={() =>
              router.push(
                `/seller/orders/${order.id}`
              )
            }
            onConfirm={() => {
              setShowConfirmFor(
                order.id
              );
              setShowCancelFor(
                null
              );
              setSellerMessage(
                t.order_thank_you_message ??
                  "Thank you ❤️"
              );
            }}
            onCancel={() => {
              setShowCancelFor(
                order.id
              );
              setShowConfirmFor(
                null
              );
              setSelectedReason(
                ""
              );
              setCustomReason(
                ""
              );
            }}
            onShipping={() =>
              setConfirmShippingId(
                order.id
              )
            }
          />
        )}
        renderExtra={(
          order
        ) => (
          <>
            {/* CONFIRM */}
            {showConfirmFor ===
              order.id && (
              <div className="mt-3 bg-white border rounded-2xl p-4 shadow-sm space-y-3">
                <p className="text-sm font-semibold">
                  {t.confirm_order ??
                    "Confirm Order"}
                </p>

                <textarea
                  rows={3}
                  value={
                    sellerMessage
                  }
                  onChange={(
                    e
                  ) =>
                    setSellerMessage(
                      e
                        .target
                        .value
                    )
                  }
                  className="w-full border rounded-xl p-3 text-sm"
                />

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() =>
                      setShowConfirmFor(
                        null
                      )
                    }
                    className="py-2 border rounded-xl"
                  >
                    {t.close ??
                      "Close"}
                  </button>

                  <button
                    disabled={
                      processingId ===
                      order.id
                    }
                    onClick={() =>
                      handleConfirm(
                        order.id
                      )
                    }
                    className="py-2 bg-green-600 text-white rounded-xl disabled:opacity-50"
                  >
                    {t.confirm ??
                      "Confirm"}
                  </button>
                </div>
              </div>
            )}

            {/* CANCEL */}
            {showCancelFor ===
              order.id && (
              <div className="mt-3 bg-white border rounded-2xl p-4 shadow-sm space-y-3">
                <p className="text-sm font-semibold">
                  {t.cancel_order ??
                    "Cancel Order"}
                </p>

                <div className="space-y-2">
                  {cancelReasons.map(
                    (
                      reason
                    ) => (
                      <button
                        key={
                          reason
                        }
                        onClick={() =>
                          setSelectedReason(
                            reason
                          )
                        }
                        className={`w-full text-left px-3 py-2 rounded-xl border ${
                          selectedReason ===
                          reason
                            ? "border-red-500 bg-red-50 text-red-600"
                            : "border-gray-200"
                        }`}
                      >
                        {
                          reason
                        }
                      </button>
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
                        e
                          .target
                          .value
                      )
                    }
                    placeholder={
                      t.enter_reason ??
                      "Enter reason"
                    }
                    className="w-full border rounded-xl p-3 text-sm"
                  />
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() =>
                      setShowCancelFor(
                        null
                      )
                    }
                    className="py-2 border rounded-xl"
                  >
                    {t.close ??
                      "Close"}
                  </button>

                  <button
                    onClick={() =>
                      handleCancel(
                        order.id
                      )
                    }
                    className="py-2 bg-red-500 text-white rounded-xl"
                  >
                    {t.ok ??
                      "OK"}
                  </button>
                </div>
              </div>
            )}

            {/* SHIPPING */}
            {confirmShippingId ===
              order.id && (
              <div className="mt-3 bg-white border rounded-2xl p-4 shadow-sm space-y-3">
                <p className="text-sm font-semibold">
                  {t.start_shipping ??
                    "Start shipping?"}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() =>
                      setConfirmShippingId(
                        null
                      )
                    }
                    className="py-2 border rounded-xl"
                  >
                    {t.cancel ??
                      "Cancel"}
                  </button>

                  <button
                    onClick={() =>
                      handleShipping(
                        order.id
                      )
                    }
                    className="py-2 bg-blue-600 text-white rounded-xl"
                  >
                    {t.ok ??
                      "OK"}
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

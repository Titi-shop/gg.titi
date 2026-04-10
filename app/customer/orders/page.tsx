"use client";
export const dynamic = "force-dynamic";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { getPiAccessToken } from "@/lib/piAuth";
import { formatPi } from "@/lib/pi";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/* =========================
TYPES (MATCH API)
========================= */

interface OrderItem {
  product_id: number
  product_name: string
  thumbnail: string
  images?: string[]

  unit_price: number;
  quantity: number;
  total_price: number;

  seller_message?: string | null;
  seller_cancel_reason?: string | null;
}

interface Order {
  id: string;
  order_number: string;

  total: number;
  status: string;

  created_at: string;

  order_items?: OrderItem[];
}

type OrderTab =
  | "all"
  | "pending"
  | "pickup"
  | "shipping"
  | "completed"
  | "returned"
  | "cancelled";

/* =========================
PAGE
========================= */

export default function CustomerOrdersPage() {

  const { t } = useTranslation();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<OrderTab>("all");
 const [paying, setPaying] = useState(false);
  /* =========================
  LOAD ORDERS
  ========================= */

  const { data, isLoading } = useSWR(
  user ? "/api/orders" : null,
  fetcher,
  {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  }
);

const orders: Order[] = data?.orders ?? [];
  /* =========================
  REBUY
  ========================= */

  async function handleRebuy(order: Order) {

  if (paying) return;
  setPaying(true);

  if (authLoading || !user) {
    alert("Auth chưa sẵn sàng");
    setPaying(false);
    return;
  }

  if (!window.Pi) {
    alert("Pi chưa sẵn sàng");
    setPaying(false);
    return;
  }

  const item = order.order_items?.[0];

  if (!item) {
    alert("Không có sản phẩm");
    setPaying(false);
    return;
  }

  const total = Number(order.total);

  try {

    await window.Pi.createPayment(
      {
        amount: Number(total.toFixed(6)),
        memo: "Thanh toán đơn hàng TiTi",

        metadata: {
          shipping: null,
          product: {
            id: item.product_id,
            name: item.product_name,
            image: item.thumbnail || item.images?.[0] || "",
            price: item.unit_price
          },
          quantity: item.quantity
        },
      },
      {
        onReadyForServerApproval: async (paymentId, callback) => {
          const token = await getPiAccessToken();

          const res = await fetch("/api/pi/approve", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ paymentId }),
          });

          if (!res.ok) {
            alert("Approve thất bại");
            return;
          }

          callback();
        },

        onReadyForServerCompletion: async (paymentId, txid) => {
          const token = await getPiAccessToken();

          const res = await fetch("/api/pi/complete", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              paymentId,
              txid,
              product_id: item.product_id,
              quantity: item.quantity,
              total,
              shipping: null,
              user: {
                pi_uid: user.pi_uid
              }
            }),
          });

          if (!res.ok) {
            alert("Complete thất bại");
            return;
          }

          router.push("/customer/pending");
        },

        onCancel: () => {},
        onError: () => {
          alert("Thanh toán lỗi");
        },
      }
    );

  } catch (err) {
    console.error(err);
    alert("Không thể thanh toán");
  } finally {
    setPaying(false);
  }
}
  /* =========================
  FILTER
  ========================= */

  const filteredOrders = useMemo(() => {

    if (activeTab === "all") return orders;

    return orders.filter((o) => o.status === activeTab);

  }, [orders, activeTab]);

  /* =========================
  UI
  ========================= */

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      <header className="bg-orange-500 text-white px-4 py-4">

        <div className="bg-orange-400 rounded-lg p-4">

          <p className="text-sm opacity-90">
            {t.orders}
          </p>

          <p className="text-xs opacity-80 mt-1">
            {filteredOrders.length}
          </p>

        </div>

      </header>

      {/* TABS */}

        <div className="bg-white border-b">
        <div className="flex gap-6 px-4 py-3 text-sm overflow-x-auto whitespace-nowrap">
          {([
            ["all", t.all],
            ["pending", t.order_pending],
            ["pickup", t.order_pickup],
            ["shipping", t.order_shipping],
            ["completed", t.order_completed],
            ["returned", t.order_returned],
            ["cancelled", t.order_cancelled],
          ] as [OrderTab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`pb-2 border-b-2 ${
                activeTab === key
                  ? "border-orange-500 text-orange-500 font-semibold"
                  : "border-transparent text-gray-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {/* CONTENT */}

      <section className="px-4 mt-4 space-y-4">

        {isLoading || authLoading ? (

          <p className="text-center text-gray-500">
            {t.loading}
          </p>

        ) : filteredOrders.length === 0 ? (

          <p className="text-center text-gray-400">
            {t.no_orders}
          </p>

        ) : (

          filteredOrders.map((o) => (

            <div
              key={o.id}
              className="bg-white rounded-lg shadow-sm overflow-hidden"
            >

              <div className="flex justify-between px-4 py-3 border-b text-sm">

                <span className="font-semibold">
                  #{o.order_number}
                </span>

                <span className="text-orange-500 text-right max-w-[120px] leading-tight line-clamp-2">
                  {t[`order_${o.status}`] ?? o.status}
                </span>

              </div>

              {o.order_items?.map((item, idx) => (

                <div
                  key={idx}
                  className="flex gap-3 items-center px-4 py-3 border-b"
                >

                  <div className="w-14 h-14 bg-gray-100 rounded overflow-hidden flex-shrink-0">

                    <img
               src={item.thumbnail}
               loading="lazy"
                />

                  </div>

                  <div className="flex-1 min-w-0">

                    <p className="text-sm font-medium line-clamp-2 min-h-[40px]">
                      {item.product_name}
                    </p>

                    <p className="text-xs text-gray-500">
                      x{item.quantity} · π
                      {formatPi(
                        Number(item.total_price) /
                        Number(item.quantity || 1)
                      )}
                    </p>

                    {item.seller_message && (
                      <p className="text-xs text-blue-600 mt-1">
                        {t.seller_message}: {item.seller_message}
                      </p>
                    )}

                    {item.seller_cancel_reason && (
                      <p className="text-xs text-red-500 mt-1">
                        {t.seller_cancel_reason}: {item.seller_cancel_reason}
                      </p>
                    )}

                  </div>

                </div>

              ))}

              <div className="flex justify-between items-center px-4 py-3 text-sm">

                <span>
                  {t.total}: <b>π{formatPi(o.total)}</b>
                </span>

               <button
  disabled={paying}
  onClick={() => handleRebuy(o)}
  className="px-4 py-1 border border-orange-500 text-orange-500 rounded disabled:opacity-50"
>
  {paying ? "Processing..." : t.buy_now}
</button>

              </div>

            </div>

          ))

        )}

      </section>

    </main>
  );
}

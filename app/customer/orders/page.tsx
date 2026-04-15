"use client";

export const dynamic = "force-dynamic";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { getPiAccessToken } from "@/lib/piAuth";
import { formatPi } from "@/lib/pi";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/* ========================= TYPES ========================= */

interface OrderItem {
  product_id: number;
  product_name: string;
  thumbnail: string;
  images?: string[];
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
  | "confirmed"
  | "shipping"
  | "completed"
  | "cancelled";

/* ========================= FETCHER (AUTH) ========================= */

const fetcher = async (url: string) => {
  const token = await getPiAccessToken();

  if (!token) return [];

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.orders ?? [];
};

/* ========================= PAGE ========================= */

export default function CustomerOrdersPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<OrderTab>("all");
  const [paying, setPaying] = useState(false);

  /* ========================= SWR ========================= */

  const { data: orders = [], isLoading } = useSWR(
    user ? "/api/orders" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );

  /* ========================= FILTER ========================= */

  const filteredOrders = useMemo(() => {
    if (activeTab === "all") return orders;
    return orders.filter((o: Order) => o.status === activeTab);
  }, [orders, activeTab]);

  /* ========================= REBUY ========================= */

  async function handleRebuy(order: Order) {
    if (paying) return;
    setPaying(true);

    try {
      if (!window.Pi || !user) return;
      const item = order.order_items?.[0];
      if (!item) return;
      const total = Number(order.total);
      await window.Pi.createPayment(
        {
          amount: Number(total.toFixed(6)),
          memo: "Thanh toán đơn hàng TiTi",
          metadata: {
            product: {
              id: item.product_id,
              name: item.product_name,
              image: item.thumbnail || item.images?.[0] || "",
              price: item.unit_price,
            },
            quantity: item.quantity,
          },
        },
        {
          onReadyForServerApproval: async (paymentId, callback) => {
            const token = await getPiAccessToken();

            await fetch("/api/pi/approve", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ paymentId }),
            });

            callback();
          },

          onReadyForServerCompletion: async (paymentId, txid) => {
            const token = await getPiAccessToken();

            await fetch("/api/pi/complete", {
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
                user: { pi_uid: user.pi_uid },
              }),
            });

            router.push("/customer/pending");
          },

          onCancel: () => {},
          onError: () => alert("Thanh toán lỗi"),
        }
      );
    } catch (err) {
      console.error(err);
    } finally {
      setPaying(false);
    }
  }

  /* ========================= UI ========================= */

  return (
    <main className="min-h-screen bg-gray-100 pb-24">
      {/* HEADER */}
      <header className="bg-orange-500 text-white px-4 py-4">
        <div className="bg-orange-400 rounded-lg p-4">
          <p className="text-sm">{t.orders}</p>
          <p className="text-xs mt-1">{filteredOrders.length}</p>
        </div>
      </header>

      {/* TABS */}
      <div className="bg-white border-b">
        <div className="flex gap-6 px-4 py-3 text-sm overflow-x-auto">
          {[
            ["all", t.all],
            ["pending", t.order_pending],
            ["confirmed", t.order_confirmed],
            ["shipping", t.order_shipping],
            ["completed", t.order_completed],
            ["cancelled", t.order_cancelled],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as OrderTab)}
              className={`pb-2 border-b-2 ${
                activeTab === key
                  ? "border-orange-500 text-orange-500"
                  : "text-gray-500"
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
          <div className="space-y-3 animate-pulse">
            <div className="h-20 bg-gray-200 rounded" />
            <div className="h-20 bg-gray-200 rounded" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <p className="text-center text-gray-400">{t.no_orders}</p>
        ) : (
          filteredOrders.map((o: Order) => (
            <div key={o.id} className="bg-white rounded-lg shadow-sm">
              <div className="flex justify-between px-4 py-3 border-b text-sm">
                <span>#{o.order_number}</span>
                <span className="text-orange-500">
                  {t[`order_${o.status}`] ?? o.status}
                </span>
              </div>

              {o.order_items?.map((item, idx) => (
                <div key={idx} className="flex gap-3 p-4 border-b">
                  <img
                    src={item.thumbnail}
                    loading="lazy"
                    className="w-14 h-14 object-cover rounded"
                  />

                  <div className="flex-1">
                    <p className="text-sm line-clamp-2">
                      {item.product_name}
                    </p>

                    <p className="text-xs text-gray-500">
                      x{item.quantity} · π
                      {formatPi(item.unit_price)}
                    </p>
                  </div>
                </div>
              ))}

              <div className="flex justify-between px-4 py-3 text-sm">
                <span>
                  {t.total}: <b>π{formatPi(o.total)}</b>
                </span>

                <button
                  disabled={paying}
                  onClick={() => handleRebuy(o)}
                  className="border px-3 py-1 rounded text-orange-500 disabled:opacity-50"
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

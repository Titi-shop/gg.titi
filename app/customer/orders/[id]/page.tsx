"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPiAccessToken } from "@/lib/piAuth";
import { formatPi } from "@/lib/pi";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipping"
  | "completed"
  | "cancelled"
  | "return_requested";

interface Product {
  id: string;
  name: string;
  thumbnail: string;
}

interface OrderItem {
  quantity: number;
  price: number;
  product_id: string;
  product?: Product;
}

interface Order {
  id: string;
  total: number;
  status: OrderStatus;
  created_at: string;
  order_items: OrderItem[];
}

export default function OrderDetailPage() {
  const { t } = useTranslation();

  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const { user, loading: authLoading } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;

    void loadOrder();
  }, [authLoading, user, orderId]);

  async function loadOrder(): Promise<void> {

    if (authLoading) return;
    if (!user) return;

    try {

      const token = await getPiAccessToken();
      if (!token) return;

      const res = await fetch(`/api/orders/${orderId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Load failed");

      const data = await res.json();
      setOrder(data);

    } catch (err) {

      console.error("Load order error:", err);

    } finally {

      setLoading(false);

    }
  }

  if (loading || authLoading) {
    return (
      <main className="p-6 text-center text-gray-400">
        {t.loading_order}
      </main>
    );
  }

  if (!order) {
    return (
      <main className="p-6 text-center text-red-500">
        {t.order_not_found}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 pb-20">
      <div className="max-w-xl mx-auto p-4 space-y-6">

        {/* HEADER */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h1 className="text-lg font-bold mb-2">
            🧾 {t.order_detail}
          </h1>

          <p className="text-sm text-gray-500">
            {t.order_id}: {order.id}
          </p>

          <p className="text-sm mt-1">
            {t.status}:{" "}
            <span className="font-semibold text-orange-500">
              {t[`order_status_${order.status}`]}
            </span>
          </p>

          <p className="text-xs text-gray-400 mt-1">
            {t.created_at}:{" "}
            {new Date(order.created_at).toLocaleString()}
          </p>
        </div>

        {/* PRODUCTS */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
          {order.order_items.map((item, idx) => (
            <div key={idx} className="flex gap-3">
              <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden">
                {item.product?.thumbnail && (
                  <img
  src={item.product?.thumbnail || "/placeholder.png"}
  alt={item.product?.name || "product"}
  className="w-full h-full object-cover"
/>
                )}
              </div>

              <div className="flex-1">
                <p className="font-medium text-sm">
                  {item.product?.name}
                </p>
                <p className="text-xs text-gray-500">
                  x{item.quantity}
                </p>
                <p className="text-sm font-semibold mt-1">
                  π{formatPi(item.price)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* TOTAL */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-base font-bold">
             {t.total ?? "Total"}: π
                  {formatPi(order.total)}
          </p>
        </div>

        {/* ACTIONS */}
        <div className="space-y-3">

          {order.status === "completed" && (
            <button
              onClick={() =>
                router.push(
                  `/customer/orders/${order.id}/return`
                )
              }
              className="w-full py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              {t.request_return}
            </button>
          )}

          {order.status === "return_requested" && (
            <button
              onClick={() =>
                router.push(`/customer/returns`)
              }
              className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              {t.view_return_status}
            </button>
          )}

        </div>

      </div>
    </main>
  );
}

"use client";

export const dynamic = "force-dynamic";

import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";
import { getPiAccessToken } from "@/lib/piAuth";
import { formatPi } from "@/lib/pi";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* ================= TYPES ================= */

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
  product_name?: string;
  thumbnail?: string;
}

interface Order {
  id: string;
  total: number;
  status: OrderStatus;
  created_at: string;
  order_items: OrderItem[];
}

/* ================= FETCHER ================= */

const fetcher = async (url: string) => {
  const token = await getPiAccessToken();
  if (!token) return null;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) return null;

  return res.json();
};

/* ================= PAGE ================= */

export default function OrderDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();

  const orderId = params.id as string;

  const { user, loading: authLoading } = useAuth();

  /* ================= SWR ================= */

  const {
    data: order,
    isLoading,
  } = useSWR(
    user && orderId ? `/api/orders/${orderId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  /* ================= STATE ================= */

  if (isLoading || authLoading) {
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

  /* ================= UI ================= */

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
              {t[`order_status_${order.status}`] ?? order.status}
            </span>
          </p>

          <p className="text-xs text-gray-400 mt-1">
            {t.created_at}:{" "}
            {new Date(order.created_at).toLocaleString()}
          </p>
        </div>

        {/* PRODUCTS */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
          {order.order_items?.map((item: OrderItem, idx: number) => {

            const image =
              item.product?.thumbnail ||
              item.thumbnail ||
              "/placeholder.png";

            const name =
              item.product?.name ||
              item.product_name ||
              "Product";

            return (
              <div key={idx} className="flex gap-3">

                <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden">
                  <img
                    src={image}
                    alt={name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {name}
                  </p>

                  <p className="text-xs text-gray-500">
                    x{item.quantity}
                  </p>

                  <p className="text-sm font-semibold mt-1">
                    π{formatPi(item.price)}
                  </p>
                </div>

              </div>
            );
          })}
        </div>

        {/* TOTAL */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-base font-bold">
            {t.total ?? "Total"}: π{formatPi(order.total)}
          </p>
        </div>

        {/* ACTIONS */}
        <div className="space-y-3">

          {order.status === "completed" && (
            <button
              onClick={() =>
                router.push(`/customer/orders/${order.id}/return`)
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

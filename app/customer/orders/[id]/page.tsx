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
  | "refunded";

interface OrderItem {
  id: string;
  product_name: string;
  thumbnail: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: string;
}

interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  seller_message?: string;
  seller_cancel_reason?: string;
  order_items: OrderItem[];
  shipping_name: string;
shipping_phone: string;
shipping_address_line: string;
shipping_ward?: string | null;
shipping_district?: string | null;
shipping_region?: string | null;
  shipping_country?: string | null;
  shipping_postal_code?: string | null;
}

/* ================= FETCHER ================= */

const fetcher = async (url: string): Promise<Order | null> => {
  try {
    const token = await getPiAccessToken();
    if (!token) return null;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = await res.json();

    return {
      id: data.id,
      order_number: data.order_number,
      status: data.status,
      total: Number(data.total ?? 0),
      created_at: data.created_at,
      shipping_name: data.shipping_name ?? "",
shipping_phone: data.shipping_phone ?? "",
shipping_address_line: data.shipping_address_line ?? "",
shipping_ward: data.shipping_ward ?? null,
shipping_district: data.shipping_district ?? null,
shipping_region: data.shipping_region ?? null,
shipping_country: data.shipping_country ?? null,
shipping_postal_code: data.shipping_postal_code ?? null,

      seller_message: data.seller_message ?? null,
      seller_cancel_reason: data.seller_cancel_reason ?? null,

      order_items: (data.order_items || []).map((i: any) => ({
        id: i.id,
        product_name: i.product_name ?? "",
        thumbnail: i.thumbnail ?? "",
        quantity: Number(i.quantity ?? 0),
        unit_price: Number(i.unit_price ?? 0),
        total_price: Number(i.total_price ?? 0),
        status: i.status ?? "pending",
      })),
    };
  } catch {
    return null;
  }
};

/* ================= STATUS COLOR ================= */

function getStatusColor(status: string) {
  switch (status) {
    case "pending":
      return "text-orange-500";
    case "confirmed":
      return "text-blue-500";
    case "shipping":
      return "text-purple-500";
    case "completed":
      return "text-green-600";
    case "cancelled":
      return "text-red-500";
    default:
      return "text-gray-500";
  }
}

/* ================= PAGE ================= */

export default function OrderDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();

  const orderId =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : "";

  const { data: order, isLoading } = useSWR(
    user && orderId ? `/api/orders/${orderId}` : null,
    fetcher
  );

  /* ================= STATE ================= */

  if (isLoading || authLoading) {
    return (
      <p className="text-center mt-10 text-gray-400">
        {t.loading_order ?? "Đang tải..."}
      </p>
    );
  }

  if (!order) {
    return (
      <p className="text-center mt-10 text-red-500">
        {t.order_not_found ?? "Không tìm thấy đơn"}
      </p>
    );
  }

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-100 pb-20">

      {/* HEADER */}
      <div className="bg-white p-4 border-b">
        <button
          onClick={() => router.back()}
          className="text-sm mb-2"
        >
          ← {t.back ?? "Quay lại"}
        </button>

        <div className="flex justify-between items-center">
          <p className="font-semibold">
            #{order.order_number}
          </p>

          <span className={`text-sm font-medium ${getStatusColor(order.status)}`}>
            {t[`order_status_${order.status}`] ?? order.status}
          </span>
        </div>

        <p className="text-xs text-gray-400 mt-1">
          {new Date(order.created_at).toLocaleString()}
        </p>
      </div>
      {/* SHIPPING */}
<div className="bg-white mt-3 p-4 border-b">
  <p className="font-semibold text-sm mb-2">
    📍 {t.shipping_address ?? "Địa chỉ nhận hàng"}
  </p>

  <p className="text-sm">
    {order.shipping_name} · {order.shipping_phone}
  </p>

  <p className="text-xs text-gray-600 mt-1">
    {[
      order.shipping_address_line,
      order.shipping_ward,
      order.shipping_district,
      order.shipping_region,
    ]
      .filter(Boolean)
      .join(", ")}
  </p>

  {(order.shipping_country || order.shipping_postal_code) && (
    <p className="text-xs text-gray-400">
      {order.shipping_country}
      {order.shipping_postal_code && ` · ${order.shipping_postal_code}`}
    </p>
  )}
</div>

      {/* SELLER MESSAGE */}
      {order.seller_message && (
        <div className="bg-green-50 text-green-700 text-sm px-4 py-3 border-b">
          ✔ {order.seller_message}
        </div>
      )}

      {order.seller_cancel_reason && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 border-b">
          ✖ {order.seller_cancel_reason}
        </div>
      )}

      {/* PRODUCTS */}
      <div className="mt-3 bg-white divide-y">
        {order.order_items.map((item) => (
          <div key={item.id} className="flex gap-3 p-4">

            <img
              src={item.thumbnail || "/placeholder.png"}
              className="w-20 h-20 rounded object-cover border"
            />

            <div className="flex-1">
              <p className="text-sm font-medium line-clamp-2">
                {item.product_name}
              </p>

              <p className="text-xs text-gray-500 mt-1">
                x{item.quantity}
              </p>

              <p className="text-xs mt-1">
                Status:{" "}
                <span className="text-orange-500">
                  {item.status}
                </span>
              </p>

              <p className="text-sm font-semibold mt-2">
                π{formatPi(item.total_price)}
              </p>
            </div>

          </div>
        ))}
      </div>

      {/* TOTAL */}
      <div className="mt-3 bg-white p-4 flex justify-between font-semibold">
        <span>{t.total ?? "Tổng tiền"}</span>
        <span className="text-orange-600">
          π{formatPi(order.total)}
        </span>
      </div>

      {/* ACTION */}
      <div className="p-4 space-y-3">

        {order.status === "completed" && (
          <button
            onClick={() =>
              router.push(`/customer/orders/${order.id}/return`)
            }
            className="w-full py-2 bg-red-500 text-white rounded-lg"
          >
            {t.request_return ?? "Yêu cầu hoàn hàng"}
          </button>
       <button
  onClick={() => router.push(`/product/${order.order_items[0]?.product_id}`)}
  className="w-full py-2 border border-orange-500 text-orange-500 rounded-lg"
>
  {t.buy_again ?? "Mua lại"}
</button>
        )}

      </div>

    </main>
  );
}

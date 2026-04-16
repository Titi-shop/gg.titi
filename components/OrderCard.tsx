"use client";

import { formatPi } from "@/lib/pi";
import Image from "next/image";

/* ================= TYPES ================= */

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
  created_at: string;
  shipping_name?: string;
  total: number;
  order_items: OrderItem[];
}

/* ================= HELPER ================= */

function formatDate(date: string) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/* ================= COMPONENT ================= */

type Props = {
  order: Order;
  onClick?: () => void;
};

export default function OrderCard({ order, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border overflow-hidden cursor-pointer active:scale-[0.98] transition"
    >
      {/* HEADER */}
      <div className="flex justify-between px-4 py-3 border-b bg-gray-50">
        <div>
          <p className="font-semibold text-sm">
            #{order.order_number}
          </p>

          <p className="text-xs text-gray-500">
            {formatDate(order.created_at)}
          </p>
        </div>
      </div>

      {/* CUSTOMER */}
      {order.shipping_name && (
        <div className="px-4 py-3 text-sm border-b">
          <span className="text-gray-500">Customer: </span>
          {order.shipping_name}
        </div>
      )}

      {/* PRODUCTS */}
      <div className="divide-y">
        {order.order_items?.map((item) => (
          <div key={item.id} className="flex gap-3 p-4">
            <div className="w-14 h-14 bg-gray-100 rounded-lg overflow-hidden">
              <Image
                src={item.thumbnail || "/placeholder.png"}
                alt={item.product_name}
                width={56}
                height={56}
                className="object-cover"
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium line-clamp-1">
                {item.product_name}
              </p>

              <p className="text-xs text-gray-500">
                x{item.quantity} · π{formatPi(item.unit_price)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div className="px-4 py-3 border-t bg-gray-50 text-sm">
        <span className="font-semibold">
          Total: π{formatPi(order.total)}
        </span>
      </div>
    </div>
  );
}

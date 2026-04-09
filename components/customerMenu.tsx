"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Package,
  Wallet,
  HelpCircle,
  MessageCircle,
  Globe,
  MapPin,
  Store,
} from "lucide-react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { getPiAccessToken } from "@/lib/piAuth";

export default function CustomerMenu() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, pilogin } = useAuth();

  const [sellerLoading, setSellerLoading] = useState(false);
  const [sellerMessage, setSellerMessage] = useState<string | null>(null);

  const isSeller = user?.role === "seller" || user?.role === "admin";

  async function handleSellerClick() {
  if (sellerLoading) return;

  if (!user) {
    await pilogin();
    return;
  }

  if (isSeller) {
    router.push("/seller");
    return;
  }

  try {
    setSellerLoading(true);
    setSellerMessage(null);

    const token = await getPiAccessToken();

    if (!token) {
      setSellerMessage(`⚠️ ${t.session_expired ?? "Session expired"}`);
      await pilogin();
      return;
    }

    const res = await fetch("/api/seller/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const err =
        typeof data === "object" &&
        data !== null &&
        "error" in data
          ? String((data as { error: string }).error)
          : t.register_failed ?? "Register failed";

      setSellerMessage(`❌ ${err}`);
      return;
    }

    setSellerMessage(
      `✅ ${t.seller_request_sent ?? "Seller request sent"}`
    );
  } catch (err) {
    console.error("SELLER REGISTER ERROR:", err);
    setSellerMessage(`❌ ${t.system_error ?? "System error"}`);
  } finally {
    setSellerLoading(false);
  }
}

  const customerMenuItems = [
    { label: t.profile, icon: <User size={22} />, path: "/customer/profile" },
    { label: t.my_orders, icon: <Package size={22} />, path: "/customer/orders" },
    { label: t.pi_wallet, icon: <Wallet size={22} /> },
    { label: t.messages, icon: <MessageCircle size={22} /> },
    { label: t.language, icon: <Globe size={22} /> },
    {
      label: t.shipping_address,
      icon: <MapPin size={22} />,
      path: "/customer/address",
    },
    { label: t.support, icon: <HelpCircle size={22} /> },
    {
      label: isSeller
        ? t.seller_center || "Quản lý bán hàng"
        : t.register_seller || "Đăng ký bán hàng",
      icon: <Store size={22} />,
      onClick: handleSellerClick,
    },
  ];

  return (
    <div className="bg-white mx-3 mt-6 p-5 rounded-2xl shadow-lg border border-gray-100 mb-6">
      <div className="grid grid-cols-4 gap-y-6 text-center">
        {customerMenuItems.map((item, i) => (
          <button
            key={i}
            onClick={() => {
              if (item.onClick) item.onClick();
              else if (item.path) router.push(item.path);
            }}
            disabled={sellerLoading && item.onClick !== undefined}
            className="flex flex-col items-center justify-start h-[96px] text-gray-700 hover:text-orange-500 transition disabled:opacity-60"
          >
            {/* ICON */}
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 shadow-sm mb-2">
              {item.icon}
            </div>

            {/* LABEL */}
            <span className="text-[11px] font-medium leading-snug text-center line-clamp-2 max-w-[72px]">
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {sellerMessage && (
        <div
          className={`mt-4 text-center text-sm ${
            sellerMessage.startsWith("✅")
              ? "text-green-600"
              : "text-red-600"
          }`}
        >
          {sellerMessage}
        </div>
      )}

      {!isSeller && !sellerMessage && (
        <div className="mt-4 text-center text-xs text-gray-500">
          {t.seller_note ||
            "Bạn có thể đăng ký bán hàng để mở gian hàng của mình."}
        </div>
      )}
    </div>
  );
}

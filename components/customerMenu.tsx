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

/* =========================
   TYPES
========================= */

type MenuItem = {
  label: string;
  icon: (active: boolean) => React.ReactNode;
  path?: string;
  onClick?: () => void | Promise<void>;
};

/* =========================
   COMPONENT
========================= */

export default function CustomerMenu() {
  const router = useRouter();

  const { t } =
    useTranslation();

  const {
    user,
    pilogin,
  } = useAuth();

  const [
    sellerLoading,
    setSellerLoading,
  ] = useState(false);

  const [
    sellerMessage,
    setSellerMessage,
  ] = useState<string | null>(
    null
  );

  const [
    activeIndex,
    setActiveIndex,
  ] = useState<number | null>(
    null
  );

  const isSeller =
    user?.role === "seller" ||
    user?.role === "admin";

  /* =========================
     SELLER ACTION
  ========================= */

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

      const token =
        await getPiAccessToken();

      if (!token) {
        setSellerMessage(
          `⚠️ ${
            t.session_expired ??
            "Session expired"
          }`
        );

        await pilogin();

        return;
      }

      const res = await fetch(
        "/api/seller/register",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data: unknown =
        await res
          .json()
          .catch(() => null);

      if (!res.ok) {
        const err =
          typeof data ===
            "object" &&
          data !== null &&
          "error" in data
            ? String(
                (
                  data as {
                    error: string;
                  }
                ).error
              )
            : t.register_failed ??
              "Register failed";

        setSellerMessage(
          `❌ ${err}`
        );

        return;
      }

      setSellerMessage(
        `✅ ${
          t.seller_request_sent ??
          "Seller request sent"
        }`
      );
    } catch (err) {
      console.error(
        "SELLER REGISTER ERROR:",
        err
      );

      setSellerMessage(
        `❌ ${
          t.system_error ??
          "System error"
        }`
      );
    } finally {
      setSellerLoading(false);
    }
  }

  /* =========================
     MENU ITEMS
  ========================= */

  const customerMenuItems: MenuItem[] =
    [
      {
  label: t.profile ?? "Profile",
  icon: (active) => (
    <User
      size={22}
      color={active ? "#f97316" : "currentColor"}
    />
  ),
  path: "/customer/profile",
},
      {
  label: t.my_orders ?? "Orders",
  icon: (active) => (
    <Package size={22} color={active ? "#f97316" : "currentColor"} />
  ),
  path: "/customer/orders",
},

{
  label: t.pi_wallet ?? "Wallet",
  icon: (active) => (
    <Wallet size={22} color={active ? "#f97316" : "currentColor"} />
  ),
  path: "/account/wallet",
},

{
  label: t.messages ?? "Messages",
  icon: (active) => (
    <MessageCircle size={22} color={active ? "#f97316" : "currentColor"} />
  ),
},

{
  label: t.language ?? "Language",
  icon: (active) => (
    <Globe size={22} color={active ? "#f97316" : "currentColor"} />
  ),
},

{
  label: t.shipping_address ?? "Address",
  icon: (active) => (
    <MapPin size={22} color={active ? "#f97316" : "currentColor"} />
  ),
  path: "/customer/address",
},

{
  label: t.support ?? "Support",
  icon: (active) => (
    <HelpCircle size={22} color={active ? "#f97316" : "currentColor"} />
  ),
},

{
  label: isSeller
    ? t.seller_center || "Seller Center"
    : t.register_seller || "Become Seller",
  icon: (active) => (
    <Store size={22} color={active ? "#f97316" : "currentColor"} />
  ),
  onClick: handleSellerClick,
},
    ];

  /* =========================
     RENDER
  ========================= */

  return (
    <section
      className="
        mx-4
        mt-4
        overflow-hidden
        rounded-3xl
        border
        shadow-sm
        transition-colors
      "
      style={{
        backgroundColor:
          "var(--card-bg)",

        borderColor:
          "var(--border-color)",
      }}
    >
      {/* HEADER */}
      <div className="px-5 py-4">
        <h2
          className="
            text-[17px]
            font-semibold
          "
          style={{
            color:
              "var(--foreground)",
          }}
        >
          {t.account ??
            "Account"}
        </h2>

        <p
          className="
            mt-0.5
            text-xs
          "
          style={{
            color:
              "var(--muted-foreground)",
          }}
        >
          {t.manage_account ??
            "Manage your account settings"}
        </p>
      </div>

      {/* DIVIDER */}
      <div
        className="h-px"
        style={{
          backgroundColor:
            "var(--border-color)",
        }}
      />

      {/* GRID */}
      <div
        className="
          grid
          grid-cols-3
          gap-y-5
          px-3
          py-5
          sm:grid-cols-4
        "
      >
        {customerMenuItems.map(
          (item, i) => {
            const active =
              activeIndex === i;

            return (
              <button
                key={i}
                type="button"
                disabled={
                  sellerLoading &&
                  !!item.onClick
                }
                onClick={() => {
                  setActiveIndex(
                    i
                  );

                  if (
                    item.onClick
                  ) {
                    item.onClick();
                  } else if (
                    item.path
                  ) {
                    router.push(
                      item.path
                    );
                  }
                }}
                className="
                  group
                  flex
                  flex-col
                  items-center
                  px-1
                  transition-all
                  active:scale-95
                  disabled:opacity-60
                "
              >
                {/* ICON */}
                <div
                  className="
                    relative
                    mb-2
                    flex
                    h-12
                    w-12
                    items-center
                    justify-center
                    rounded-full
                    border
                    shadow-sm
                    transition-all
                    duration-200
                    group-active:scale-95
                  "
                  style={{
                    backgroundColor:
                      active
                        ? "rgba(249,115,22,0.12)"
                        : "var(--soft-bg)",

                    borderColor:
                      active
                        ? "#f97316"
                        : "var(--border-color)",

                    color:
                      active
                        ? "#f97316"
                        : "var(--foreground)",
                  }}
                >
                 {item.icon(active)}
                </div>

                {/* LABEL */}
                <span
                  className="
                    line-clamp-2
                    text-center
                    text-[11px]
                    font-medium
                    leading-tight
                  "
                  style={{
                    color:
                      active
                        ? "#f97316"
                        : "var(--foreground)",
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          }
        )}
      </div>

      {/* MESSAGE */}
      {sellerMessage && (
        <>
          <div
            className="h-px"
            style={{
              backgroundColor:
                "var(--border-color)",
            }}
          />

          <div
            className="
              px-4
              py-4
              text-center
              text-sm
            "
            style={{
              color:
                sellerMessage.startsWith(
                  "✅"
                )
                  ? "#16a34a"
                  : "#ef4444",
            }}
          >
            {sellerMessage}
          </div>
        </>
      )}

      {/* FOOTER NOTE */}
      {!isSeller &&
        !sellerMessage && (
          <>
            <div
              className="h-px"
              style={{
                backgroundColor:
                  "var(--border-color)",
              }}
            />

            <div
              className="
                px-5
                py-4
                text-center
                text-xs
              "
              style={{
                color:
                  "var(--muted-foreground)",
              }}
            >
              {t.seller_note ??
                "You can register as a seller to open your own store."}
            </div>
          </>
        )}
    </section>
  );
      }

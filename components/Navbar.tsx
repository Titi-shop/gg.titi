"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ShoppingCart,
  ChevronDown,
  Sun,
  Moon,
} from "lucide-react";

import { useMemo, useEffect, useState } from "react";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { availableLanguages } from "@/app/lib/i18n";
import { useCart } from "@/app/context/CartContext";

import { toggleDarkMode } from "@/lib/theme";

export default function Navbar() {
  const { lang, setLang } = useTranslation();
  const { cart } = useCart();

  const [dark, setDark] = useState(false);

  /* ================= THEME SYNC ================= */

  useEffect(() => {
    const sync = () => {
      setDark(
        document.documentElement.classList.contains(
          "theme-dark"
        )
      );
    };

    sync();

    window.addEventListener(
      "theme-change",
      sync
    );

    return () =>
      window.removeEventListener(
        "theme-change",
        sync
      );
  }, []);

  /* ================= CART COUNT ================= */

  const cartCount = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
  }, [cart]);

  /* ================= ROLE ================= */

  const getRole = () => {
    if (typeof window === "undefined") {
      return "customer";
    }

    return window.location.pathname.startsWith(
      "/seller"
    )
      ? "seller"
      : "customer";
  };

  return (
    <>
    
      <header
        className="fixed left-0 right-0 top-0 z-50 shadow-md transition-colors duration-300"
        style={{
          backgroundColor: "var(--nav-bg)",
          color: "var(--nav-text)",
          borderBottom:
            "1px solid var(--nav-border)",
          paddingTop:
            "env(safe-area-inset-top)",
        }}
      >
        <div className="flex h-[56px] items-center justify-between px-3">

          {/* LOGO */}

          <Link
            href="/"
            className="flex items-center gap-2"
          >
            <div
              className="relative h-8 w-8 overflow-hidden rounded border"
              style={{
                borderColor: "var(--nav-border)",
                backgroundColor:
                  "var(--nav-button)",
              }}
            >
              <Image
                src="/banners/3D035BE4-0822-403D-9631-6C4CF674A519.png"
                alt="logo"
                fill
                className="object-cover"
              />
            </div>

            <span
              className="text-sm font-bold"
              style={{
                color: "var(--nav-text)",
              }}
            >
              TITI
            </span>
          </Link>

          {/* RIGHT */}

          <div className="flex items-center gap-2">

            {/* LANGUAGE */}

            <div className="relative">
              <select
                value={lang}
                onChange={(e) =>
                  setLang(e.target.value)
                }
                className="rounded border px-2 py-1 pr-6 text-xs outline-none transition-colors"
                style={{
                  backgroundColor:
                    "var(--nav-button)",
                  color: "var(--nav-text)",
                  borderColor:
                    "var(--nav-border)",
                }}
              >
                {Object.entries(
                  availableLanguages
                ).map(([code, label]) => (
                  <option
                    key={code}
                    value={code}
                  >
                    {label}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={12}
                className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2"
                style={{
                  color: "var(--nav-muted)",
                }}
              />
            </div>

            {/* DARK MODE */}

            <button
              onClick={() =>
                toggleDarkMode(getRole())
              }
              className="flex h-9 w-9 items-center justify-center rounded border transition active:scale-95"
              style={{
                borderColor:
                  "var(--nav-border)",
                backgroundColor:
                  "var(--nav-button)",
              }}
            >
              {dark ? (
                <Sun
                  size={18}
                  style={{
                    color: "var(--nav-icon)",
                  }}
                />
              ) : (
                <Moon
                  size={18}
                  style={{
                    color: "var(--nav-icon)",
                  }}
                />
              )}
            </button>

            {/* CART */}

            <Link
              href="/cart"
              className="relative"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded border transition active:scale-95"
                style={{
                  borderColor:
                    "var(--nav-border)",
                  backgroundColor:
                    "var(--nav-button)",
                }}
              >
                <ShoppingCart
                  size={18}
                  style={{
                    color: "var(--nav-icon)",
                  }}
                />
              </div>

              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] text-white">
                  {cartCount}
                </span>
              )}
            </Link>

          </div>
        </div>
      </header>
    </>
  );
}

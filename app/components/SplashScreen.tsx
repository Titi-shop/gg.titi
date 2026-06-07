"use client";

import Image from "next/image";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

export default function SplashScreen() {
  const { t } = useTranslation();

  return (
    <div
      className="
        fixed inset-0 z-[9999]
        overflow-hidden
        bg-[var(--background)]
        transition-opacity duration-500
      "
    >
      {/* BACKGROUND GLOW */}
      <div
        className="
          absolute left-1/2 top-1/2
          h-[420px] w-[420px]
          -translate-x-1/2 -translate-y-1/2
          rounded-full
          bg-orange-500/20
          blur-3xl
        "
      />

      <div
        className="
          absolute inset-0
          bg-[radial-gradient(circle_at_top,rgba(255,140,0,0.18),transparent_45%)]
        "
      />

      {/* FLOATING ORBS */}
      <div
        className="
          absolute left-10 top-20
          h-24 w-24 rounded-full
          bg-orange-500/10 blur-2xl
          animate-pulse
        "
      />

      <div
        className="
          absolute bottom-20 right-10
          h-32 w-32 rounded-full
          bg-pink-500/10 blur-3xl
          animate-pulse
        "
      />

      {/* CONTENT */}
      <div
        className="
          relative flex h-full w-full
          flex-col items-center justify-center
          px-6
        "
      >
        {/* LOGO WRAPPER */}
        <div className="relative flex items-center justify-center">
          {/* OUTER RING */}
          <div
            className="
              absolute h-44 w-44 rounded-full
              border border-orange-500/20
              animate-ping
            "
          />

          {/* SPIN RING */}
          <div
            className="
              absolute h-36 w-36 rounded-full
              border-[3px]
              border-orange-500/10
              border-t-orange-500
              border-r-pink-500
              animate-spin
            "
          />

          {/* SECOND RING */}
          <div
            className="
              absolute h-28 w-28 rounded-full
              border border-white/10
            "
          />

          {/* LOGO CARD */}
          <div
            className="
              relative flex h-24 w-24 items-center justify-center
              rounded-[28px]
              border border-white/10
              bg-white/5
              shadow-2xl
              backdrop-blur-xl
            "
          >
            <Image
              src="/banners/3D035BE4-0822-403D-9631-6C4CF674A519.png"
              alt="logo"
              width={56}
              height={56}
              priority
              className="
                object-contain
                drop-shadow-[0_0_18px_rgba(255,140,0,0.45)]
                animate-pulse
              "
            />
          </div>
        </div>

        {/* BRAND */}
        <div className="mt-12 text-center">
          <h1
            className="
              bg-gradient-to-r
              from-orange-500 via-amber-400 to-pink-500
              bg-clip-text
              text-3xl font-extrabold
              tracking-tight
              text-transparent
            "
          >
            TiTi Shop
          </h1>

          <p
            className="
              mt-3 text-sm
              tracking-[0.25em]
              text-[var(--text-muted)]
              uppercase
            "
          >
            {t.smart_marketplace ??
              "Smart Marketplace"}
          </p>
        </div>

        {/* LOADING */}
        <div className="mt-12 flex flex-col items-center">
          <div className="flex gap-2">
            <span
              className="
                h-2.5 w-2.5 rounded-full
                bg-orange-500
                animate-bounce
              "
            />

            <span
              className="
                h-2.5 w-2.5 rounded-full
                bg-pink-500
                animate-bounce
                [animation-delay:0.15s]
              "
            />

            <span
              className="
                h-2.5 w-2.5 rounded-full
                bg-amber-400
                animate-bounce
                [animation-delay:0.3s]
              "
            />
          </div>

          <p className="mt-4 text-xs text-[var(--text-muted)]">
            {t.loading_experience ??
              "Loading experience..."}
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import SplashScreen from "@/app/components/SplashScreen";
import AccountHeader from "@/components/AccountHeader";
import OrderSummary from "@/components/OrderSummary";
import CustomerMenu from "@/components/customerMenu";

export default function AccountPage() {
  const { t } = useTranslation();
  const { user, loading, pilogin, logout, piReady } = useAuth();

  const [agreed, setAgreed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /* =========================
     FIX HYDRATION
  ========================= */
  if (!mounted) return <SplashScreen />;

  /* =========================
     LOADING
  ========================= */
  if (loading) {
    return <SplashScreen />;
  }

  /* =========================
     NOT LOGGED IN
  ========================= */
  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100 px-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold mb-6">
            {t.account}
          </h1>

          <button
            onClick={pilogin}
            disabled={!piReady || !agreed}
            className={`w-full py-3 rounded-full font-semibold text-white shadow transition-all duration-200
              ${
                piReady && agreed
                  ? "bg-orange-500 hover:bg-orange-600 active:scale-95"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
          >
            {t.login}
          </button>

          <div className="mt-4 flex items-start justify-center space-x-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={agreed}
              onChange={() => setAgreed(v => !v)}
              className="mt-1 w-4 h-4 accent-orange-500"
            />
            <label className="text-left">
              {t.i_agree}{" "}
              <a
                href="https://www.termsfeed.com/live/32e8bf86-ceaf-4eb6-990e-cd1fa0b0775e"
                target="_blank"
                className="text-orange-500 underline"
              >
                {t.terms_of_use}
              </a>{" "}
              {t.and}{" "}
              <a
                href="https://www.termsfeed.com/live/8e33a9fd-71e7-4536-8033-9c8b329f3f25"
                target="_blank"
                className="text-orange-500 underline"
              >
                {t.privacy_policy}
              </a>
            </label>
          </div>
        </div>
      </main>
    );
  }

  /* =========================
     LOGGED IN
  ========================= */
  return (
    <main className="bg-gray-100 pb-32 space-y-4">
      <AccountHeader />
      <OrderSummary />
      <CustomerMenu />

      <section className="mx-4">
        <button
          onClick={logout}
          className="w-full py-4 bg-red-500 text-white rounded-2xl
            flex items-center justify-center gap-3 font-semibold text-lg shadow active:scale-95 transition"
        >
          <LogOut size={22} />
          {t.logout}
        </button>
      </section>
    </main>
  );
}

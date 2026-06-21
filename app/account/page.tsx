"use client";
import {
  useEffect,
  useState,
} from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import AccountHeader from "@/components/AccountHeader";
import OrderSummary from "@/components/OrderSummary";
import CustomerMenu from "@/components/customerMenu";

export default function AccountPage() {
  const { t } = useTranslation();
  const { user, loading, pilogin, logout, piReady } = useAuth();
  const [agreed, setAgreed] = useState(false);
  useEffect(() => {

  if (!user) {
    return;
  }

  try {

    const lastRun =
      localStorage.getItem(
        "jobs_process_last_run"
      );

    const now =
      Date.now();

    const fiveMinutes =
      5 * 60 * 1000;

    if (
      !lastRun ||
      now - Number(lastRun) >
        fiveMinutes
    ) {

      fetch(
        "/api/internal/jobs/process"
      ).catch(() => {});

      localStorage.setItem(
        "jobs_process_last_run",
        String(now)
      );
    }

  } catch {
    // silent
  }

}, [user]);

  /* =========================
     LOADING
  ========================= */
  if (loading) return null;

  /* =========================
     NOT LOGGED IN
  ========================= */
  if (!user) {
    return (
      <main
        className="
          min-h-screen
          flex
          items-center
          justify-center
          px-6
          transition-colors
        "
        style={{
          backgroundColor: "var(--background)",
          color: "var(--foreground)",
        }}
      >
        <div className="w-full max-w-sm">
          {/* FIXED HEIGHT CONTAINER */}
          <div
            className="rounded-3xl p-6 shadow-sm border"
            style={{
              backgroundColor: "var(--card-bg)",
              borderColor: "var(--border-color)",
            }}
          >
            <h1 className="text-2xl font-semibold text-center mb-8">
              {t.account}
            </h1>

            {/* BUTTON WRAPPER FIX HEIGHT */}
            <div className="h-[52px]">
              <button
                onClick={pilogin}
                disabled={!piReady || !agreed}
                className={`
                  w-full
                  h-[52px]
                  rounded-2xl
                  font-semibold
                  text-white
                  shadow
                  transition-all
                  duration-200
                  ${
                    piReady && agreed
                      ? "bg-orange-600 hover:bg-orange-700 active:scale-[0.98]"
                      : "bg-gray-400 cursor-not-allowed"
                  }
                `}
              >
                {t.login}
              </button>
            </div>

            {/* TERMS */}
            <div className="mt-5 flex items-start gap-3 text-sm leading-relaxed">
              <input
                type="checkbox"
                checked={agreed}
                onChange={() => setAgreed((v) => !v)}
                className="
                  mt-1
                  w-4
                  h-4
                  accent-orange-500
                  shrink-0
                "
              />

              <label
                style={{
                  color: "var(--muted-foreground)",
                }}
              >
                {t.i_agree}{" "}
                <a
                  href="https://www.termsfeed.com/live/32e8bf86-ceaf-4eb6-990e-cd1fa0b0775e"
                  target="_blank"
                  className="text-orange-600 underline font-medium"
                >
                  {t.terms_of_use}
                </a>{" "}
                {t.and}{" "}
                <a
                  href="https://www.termsfeed.com/live/8e33a9fd-71e7-4536-8033-9c8b329f3f25"
                  target="_blank"
                  className="text-orange-600 underline font-medium"
                >
                  {t.privacy_policy}
                </a>
              </label>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* =========================
     LOGGED IN
  ========================= */
  return (
    <main
      className="min-h-screen pb-28 space-y-4 transition-colors"
      style={{
        backgroundColor: "var(--background)",
      }}
    >
      <AccountHeader />
      <OrderSummary />
      <CustomerMenu />

      {/* LOGOUT */}
      <section className="mx-4 mt-6">
        <button
          onClick={logout}
          className="
            w-full
            py-4
            rounded-2xl
            bg-red-500
            hover:bg-red-600
            active:scale-[0.98]
            text-white
            flex
            items-center
            justify-center
            gap-3
            font-semibold
            text-lg
            shadow
            transition-all
          "
        >
          <LogOut size={22} />
          {t.logout}
        </button>
      </section>
    </main>
  );
}

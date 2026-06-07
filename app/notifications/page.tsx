"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import { getPiAccessToken } from "@/lib/piAuth";

/* ======================================================
   TYPES
====================================================== */

interface NotificationItem {
  id: string;

  title: string;
  message: string;

  date?: string;
}

/* ======================================================
   HELPERS
====================================================== */

function formatDate(
  value?: string,
  fallback?: string
) {
  if (!value) {
    return fallback ?? "Unknown time";
  }

  try {
    return new Date(value).toLocaleString();
  } catch {
    return fallback ?? "Unknown time";
  }
}

/* ======================================================
   PAGE
====================================================== */

export default function NotificationsPage() {
  const { t } = useTranslation();

  const router = useRouter();

  /* ======================================================
     STATE
  ====================================================== */

  const [notifications, setNotifications] =
    useState<NotificationItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /* ======================================================
     FETCH
  ====================================================== */

  useEffect(() => {
    let mounted = true;

    async function fetchNotifications() {
      try {
        setLoading(true);
        setError("");

        const token =
          await getPiAccessToken();

        if (!token) {
          throw new Error("NO_TOKEN");
        }

        const res = await fetch(
          "/api/notifications",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },

            cache: "no-store",
          }
        );

        if (!res.ok) {
          throw new Error(
            `HTTP_${res.status}`
          );
        }

        const data =
          (await res.json()) as unknown;

        if (!Array.isArray(data)) {
          throw new Error(
            "INVALID_RESPONSE"
          );
        }

        if (!mounted) return;

        setNotifications(
          data as NotificationItem[]
        );
      } catch (err) {
        console.error(
          "❌ Notifications fetch error:",
          err
        );

        if (!mounted) return;

        setError(
          t.fetch_error ??
            "Load notifications failed"
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void fetchNotifications();

    return () => {
      mounted = false;
    };
  }, [t]);

  /* ======================================================
     SORT
  ====================================================== */

  const sortedNotifications =
    useMemo(() => {
      return [...notifications].sort(
        (a, b) => {
          const aTime = a.date
            ? new Date(a.date).getTime()
            : 0;

          const bTime = b.date
            ? new Date(b.date).getTime()
            : 0;

          return bTime - aTime;
        }
      );
    }, [notifications]);

  /* ======================================================
     LOADING
  ====================================================== */

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)] pb-32">

        {/* HEADER */}
        <div
          className="
            sticky top-0 z-20
            border-b border-orange-500/10
            bg-[var(--nav-bg)]
            backdrop-blur
          "
        >
          <div
            className="
              mx-auto flex max-w-2xl items-center gap-3
              px-4 py-4
            "
          >
            <div
              className="
                h-9 w-9 animate-pulse rounded-xl
                bg-[var(--card-secondary)]
              "
            />

            <div className="space-y-2">
              <div
                className="
                  h-4 w-32 animate-pulse rounded
                  bg-[var(--card-secondary)]
                "
              />

              <div
                className="
                  h-3 w-20 animate-pulse rounded
                  bg-[var(--card-secondary)]
                "
              />
            </div>
          </div>
        </div>

        {/* SKELETON */}
        <div className="mx-auto max-w-2xl space-y-4 p-4">
          {Array.from({ length: 6 }).map(
            (_, index) => (
              <div
                key={index}
                className="
                  rounded-2xl
                  border border-orange-500/10
                  bg-[var(--card-bg)]
                  p-4
                "
              >
                <div
                  className="
                    h-4 w-40 animate-pulse rounded
                    bg-[var(--card-secondary)]
                  "
                />

                <div
                  className="
                    mt-3 h-3 w-full animate-pulse rounded
                    bg-[var(--card-secondary)]
                  "
                />

                <div
                  className="
                    mt-2 h-3 w-2/3 animate-pulse rounded
                    bg-[var(--card-secondary)]
                  "
                />

                <div
                  className="
                    mt-4 h-3 w-24 animate-pulse rounded
                    bg-[var(--card-secondary)]
                  "
                />
              </div>
            )
          )}
        </div>
      </main>
    );
  }

  /* ======================================================
     UI
  ====================================================== */

  return (
    <main
      className="
        min-h-screen
        bg-[var(--background)]
        text-[var(--foreground)]
        transition-colors duration-300
        pb-32
      "
    >

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header
        className="
          sticky top-0 z-20
          border-b border-orange-500/10
          bg-[var(--nav-bg)]/95
          backdrop-blur
        "
      >
        <div
          className="
            mx-auto flex max-w-2xl items-center gap-3
            px-4 py-4
          "
        >

          {/* BACK */}
          <button
            type="button"
            onClick={() => router.back()}
            className="
              flex h-10 w-10 items-center justify-center
              rounded-xl
              border border-orange-500/20
              bg-[var(--card-bg)]
              text-lg
              transition-all duration-200
              active:scale-95
            "
          >
            ←
          </button>

          {/* TITLE */}
          <div className="min-w-0 flex-1">
            <h1
              className="
                truncate
                text-lg font-bold
                text-[var(--foreground)]
              "
            >
              🔔{" "}
              {t.notifications ??
                "Notifications"}
            </h1>

            <p
              className="
                mt-1 text-xs
                text-[var(--text-muted)]
              "
            >
              {sortedNotifications.length}{" "}
              {t.notifications ??
                "notifications"}
            </p>
          </div>
        </div>
      </header>

      {/* ======================================================
          CONTENT
      ====================================================== */}

      <div className="mx-auto max-w-2xl p-4">

        {/* ERROR */}
        {error && (
          <div
            className="
              rounded-2xl
              border border-red-500/20
              bg-red-500/10
              p-4
              text-sm text-red-500
            "
          >
            {error}
          </div>
        )}

        {/* EMPTY */}
        {!error &&
          sortedNotifications.length === 0 && (
            <div
              className="
                flex flex-col items-center justify-center
                rounded-3xl
                border border-orange-500/10
                bg-[var(--card-bg)]
                px-6 py-14
                text-center
              "
            >
              <div
                className="
                  flex h-16 w-16 items-center justify-center
                  rounded-full
                  bg-orange-500/10
                  text-3xl
                "
              >
                🔔
              </div>

              <h2 className="mt-5 text-lg font-semibold">
                {t.no_notifications ??
                  "No notifications"}
              </h2>

              <p
                className="
                  mt-2 max-w-xs text-sm
                  text-[var(--text-muted)]
                "
              >
                {t.no_notifications_desc ??
                  "You don't have any notifications yet."}
              </p>
            </div>
          )}

        {/* LIST */}
        {!error &&
          sortedNotifications.length > 0 && (
            <div className="space-y-4">

              {sortedNotifications.map(
                (notification) => (
                  <article
                    key={notification.id}
                    className="
                      rounded-2xl
                      border border-orange-500/10
                      bg-[var(--card-bg)]
                      p-4
                      shadow-sm
                      transition-all duration-200

                      hover:border-orange-500/20
                    "
                  >

                    {/* TOP */}
                    <div className="flex items-start gap-3">

                      {/* ICON */}
                      <div
                        className="
                          flex h-11 w-11 shrink-0
                          items-center justify-center
                          rounded-2xl
                          bg-orange-500/10
                          text-lg
                        "
                      >
                        🔔
                      </div>

                      {/* CONTENT */}
                      <div className="min-w-0 flex-1">

                        {/* TITLE */}
                        <h2
                          className="
                            line-clamp-2
                            text-sm font-semibold
                            text-[var(--foreground)]
                          "
                        >
                          {notification.title}
                        </h2>

                        {/* MESSAGE */}
                        <p
                          className="
                            mt-2 whitespace-pre-wrap
                            break-words
                            text-sm leading-6
                            text-[var(--text-muted)]
                          "
                        >
                          {notification.message}
                        </p>

                        {/* DATE */}
                        <div className="mt-4">
                          <span
                            className="
                              inline-flex items-center
                              rounded-full
                              border border-orange-500/20
                              bg-orange-500/10
                              px-3 py-1
                              text-xs font-medium
                              text-orange-500
                            "
                          >
                            {formatDate(
                              notification.date,
                              t.unknown_time ??
                                "Unknown time"
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>
          )}

      </div>
    </main>
  );
}

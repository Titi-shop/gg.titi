"use client";

import { ArrowLeft } from "lucide-react";

export default function ReturnsSkeleton() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div
        className="
          sticky top-0 z-30
          border-b border-[var(--border)]
          bg-[var(--nav-bg)]/90
          backdrop-blur-xl
        "
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <button
            className="
              flex h-10 w-10 items-center justify-center
              rounded-xl
              bg-[var(--card-secondary)]
            "
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <div className="h-5 w-32 rounded bg-[var(--card-secondary)] animate-pulse" />
            <div className="mt-2 h-3 w-20 rounded bg-[var(--card-secondary)] animate-pulse" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="
              animate-pulse rounded-3xl
              border border-[var(--border)]
              bg-[var(--card-bg)]
              p-4
            "
          >
            <div className="flex gap-4">
              <div className="h-20 w-20 rounded-2xl bg-[var(--card-secondary)]" />

              <div className="flex-1 space-y-3">
                <div className="h-4 w-32 rounded bg-[var(--card-secondary)]" />
                <div className="h-3 w-24 rounded bg-[var(--card-secondary)]" />
                <div className="h-3 w-full rounded bg-[var(--card-secondary)]" />
                <div className="h-3 w-1/2 rounded bg-[var(--card-secondary)]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

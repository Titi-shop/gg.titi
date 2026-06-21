// =====================================================
// app/account/wallet/components/WalletSkeleton.tsx
// =====================================================

"use client";

/* =====================================================
   COMPONENT
===================================================== */

export default function WalletSkeleton() {

  return (
    <main
      className="
        min-h-screen
        bg-[var(--background)]
        p-4
      "
    >

      <div
        className="
          h-52 animate-pulse
          rounded-3xl
          bg-[var(--card-secondary)]
        "
      />

      <div className="mt-4 space-y-3">

        {[1, 2, 3, 4].map(
          (item) => (
            <div
              key={item}
              className="
                h-20 animate-pulse
                rounded-2xl
                bg-[var(--card-secondary)]
              "
            />
          )
        )}

      </div>
    </main>
  );
}

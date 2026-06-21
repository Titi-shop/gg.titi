"use client";

import { RefreshCcw } from "lucide-react";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import type { ReturnRecord } from "../types";
import ReturnCard from "./ReturnCard";

type Props = {
  returns: ReturnRecord[];
};

export default function ReturnList({
  returns,
}: Props) {
  const { t } = useTranslation();

  if (returns.length === 0) {
    return (
      <div
        className="
          mt-10 overflow-hidden rounded-3xl
          border border-dashed border-orange-500/20
          bg-[var(--card-bg)]
          p-10 text-center
        "
      >
        <div
          className="
            mx-auto mb-4 flex h-20 w-20
            items-center justify-center
            rounded-full
            bg-orange-500/10
            text-orange-500
          "
        >
          <RefreshCcw size={34} />
        </div>

        <h2
          className="
            text-lg font-bold
            text-[var(--foreground)]
          "
        >
          {t.no_return_requests ??
            "No return requests"}
        </h2>

        <p
          className="
            mt-2 text-sm
            text-[var(--text-muted)]
          "
        >
          {t.no_return_requests_desc ??
            "Your return requests will appear here."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {returns.map((item) => (
        <ReturnCard
          key={item.id}
          item={item}
        />
      ))}
    </div>
  );
}

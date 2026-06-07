"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { applyTheme, getSavedMode, ThemeRole } from "@/lib/theme";

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  useEffect(() => {
    const role: ThemeRole = pathname.startsWith("/seller")
      ? "seller"
      : "customer";

    const mode = getSavedMode();

    applyTheme(role, mode);
  }, [pathname]);

  return <>{children}</>;
}

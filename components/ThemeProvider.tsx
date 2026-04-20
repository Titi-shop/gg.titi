"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove("theme-seller", "theme-customer");

    if (pathname.startsWith("/seller")) {
      root.classList.add("theme-seller");
    } else {
      root.classList.add("theme-customer");
    }

    console.log("🎨 theme:", root.className);
  }, [pathname]);

  return <>{children}</>;
}

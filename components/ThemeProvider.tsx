"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove("theme-seller", "theme-customer");

    if (user?.role === "seller") {
      root.classList.add("theme-seller");
    } else if (user?.role === "customer") {
      root.classList.add("theme-customer");
    } else {
      // fallback
      root.classList.add("theme-customer");
    }

    console.log("🎨 theme:", root.className);
  }, [user]);

  return <>{children}</>;
}

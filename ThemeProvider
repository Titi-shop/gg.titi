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
    if (!user?.role) return; // ✅ CHẶN LỖI

    const root = document.documentElement;

    root.classList.remove("theme-seller", "theme-customer");

    if (user.role === "seller") {
      root.classList.add("theme-seller");
    } else {
      root.classList.add("theme-customer");
    }

    console.log("🎨 THEME:", user.role);
  }, [user?.role]);

  return <>{children}</>;
}

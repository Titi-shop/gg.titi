"use client";
import { useEffect } from "react";

export default function PiProvider() {
  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof window !== "undefined" && window.Pi) {
        if (!window.__pi_initialized) {
          try {
            // ⚠️ Dùng sandbox = false khi test trên Pi Testnet chính thức
            window.Pi.init({ version: "2.0", sandbox: false });
            window.__pi_initialized = true;
            console.log("✅ Pi SDK initialized (Production/Testnet real browser context)");
          } catch (err) {
            console.error("❌ Lỗi init Pi SDK:", err);
          }
        }
        clearInterval(timer);
      }
    }, 500);
    return () => clearInterval(timer);
  }, []);

  return null;
}

"use client";
import PiProvider from "@/app/pi/PiProvider";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/app/context/CartContext";
import { LanguageProvider } from "@/app/context/LanguageContext";

export default function PiLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <AuthProvider>
        <CartProvider>

          <Navbar />

          {/* ⭐ FULL WIDTH – KHÔNG flex justify-center – NỀN TRẮNG */}
          <main className="pt-20 min-h-screen w-full bg-white">
            <PiStatus />
            {children}
          </main>

          <BottomNav />
        </CartProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

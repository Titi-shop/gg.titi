"use client";

import { Toaster } from "react-hot-toast";
import { CartProvider } from "@/app/context/CartContext";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import PiProvider from "@/app/pi/PiProvider";
import "@/app/lib/i18n";

export default function PiRootClient({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <PiProvider />
      <Toaster position="top-center" reverseOrder={false} />
      <Navbar />
      <main className="bg-white">
        {children}
      </main>
      <BottomNav />
    </CartProvider>
  );
}

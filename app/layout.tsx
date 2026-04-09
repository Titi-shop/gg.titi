import "./globals.css";
import Script from "next/script";
import PiRootClient from "./PiRootClient";
import { AuthProvider } from "@/context/AuthContext";
import AlertProvider from "@/app/components/AlertProvider";
import { SWRConfig } from "swr";

export const metadata = {
  title: "aliali",
  description: "Ứng dụng thương mại điện tử thanh toán qua Pi Network Testnet",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        {/* 🔥 preload ảnh (QUAN TRỌNG) */}
  <link rel="preload" as="image" href="/avatar.png" />
  <link rel="preload" as="image" href="/banners/default-shop.png" />
        <Script
          src="https://sdk.minepi.com/pi-sdk.js"
          strategy="afterInteractive"
        />
      </head>

      <body>
        <SWRConfig
          value={{
            revalidateOnFocus: false,
            dedupingInterval: 5000,
            shouldRetryOnError: false,
          }}
        >
          <AlertProvider />
          <AuthProvider>
            <PiRootClient>{children}</PiRootClient>
          </AuthProvider>
        </SWRConfig>
      </body>
    </html>
  );
}

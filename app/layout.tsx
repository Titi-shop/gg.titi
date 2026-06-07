import "./globals.css";
import Script from "next/script";
import PiRootClient from "./PiRootClient";
import { AuthProvider } from "@/context/AuthContext";
import AlertProvider from "@/app/components/AlertProvider";
import { SWRConfig } from "swr";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata = {
  title: "aliali",
  description:
    "Ứng dụng thương mại điện tử thanh toán qua Pi Network Testnet",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="theme-light">
      <head>
        <link rel="preload" as="image" href="/avatar.png" />
        <link rel="preload" as="image" href="/banners/default-shop.png" />

        <Script
          src="https://sdk.minepi.com/pi-sdk.js"
          strategy="afterInteractive"
        />

        {/* 🔥 FIX: tránh FOUC (nháy theme khi load) */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            (function () {
              try {
                const theme = localStorage.getItem("theme") || "theme-light";
                document.documentElement.className = theme;
              } catch (e) {}
            })();
          `}
        </Script>
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
            <ThemeProvider>
              <PiRootClient>{children}</PiRootClient>
            </ThemeProvider>
          </AuthProvider>
        </SWRConfig>
      </body>
    </html>
  );
}

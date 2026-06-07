"use client";
import Script from "next/script";

export default function PiScriptLoader() {
  return (
    <Script
      src="https://sdk.minepi.com/pi-sdk.js"
      strategy="afterInteractive"
      onLoad={() => console.log("✅ Pi SDK script loaded (client)")}
    />
  );
}

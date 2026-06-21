"use client";

import { createContext, useContext, useEffect, useState } from "react";
type PiContextType = {
  ready: boolean;
};

const PiContext = createContext<PiContextType>({
  ready: false,
});

export function PiProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const initCheck = async () => {
      console.log("🟡 [PiContext] waiting SDK...");

      timer = setInterval(async () => {
        if (typeof window === "undefined") return;

        if (window.Pi && (window as any).__pi_initialized) {
          console.log("🟢 [PiContext] SDK fully ready");

          setReady(true);
          clearInterval(timer);
        } else {
          console.log("🟠 [PiContext] SDK not ready yet");
        }
      }, 300);
    };

    initCheck();

    return () => clearInterval(timer);
  }, []);

  return (
    <PiContext.Provider value={{ ready }}>
      {children}
    </PiContext.Provider>
  );
}

export const usePi = () => useContext(PiContext);

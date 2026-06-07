"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { getPiAccessToken, clearPiToken } from "@/lib/piAuth";

/* ========================= TYPES ========================= */

export type PiUser = {
  id: string;
  pi_uid: string;
  username: string;
  wallet_address?: string | null;
  role?: string;
};

type AuthContextType = {
  user: PiUser | null;
  loading: boolean;
  piReady: boolean;
  pilogin: () => Promise<void>;
  logout: () => void;
};

const USER_KEY = "pi_user";

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  piReady: false,
  pilogin: async () => {},
  logout: () => {},
});

/* ========================= PROVIDER ========================= */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [piReady, setPiReady] = useState(false);

  /* ================= PI READY ================= */

  useEffect(() => {
    if (typeof window === "undefined") return;

    const timer = setInterval(() => {
      if (window.Pi) {
        setPiReady(true);
        clearInterval(timer);
      }
    }, 300);

    return () => clearInterval(timer);
  }, []);

  /* ================= INIT (NO AUTO LOGIN) ================= */

  useEffect(() => {
  if (!piReady) return;

  const initAuth = async () => {
    try {
      const token = await getPiAccessToken();

      if (!token) {
        setUser(null);
        return;
      }

      const res = await fetch("/api/pi/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        setUser(null);
        return;
      }

      const data: unknown = await res.json();

      if (
        typeof data === "object" &&
        data !== null &&
        "user" in data
      ) {
        const verifiedUser = (data as { user: PiUser }).user;

        setUser(verifiedUser);
        localStorage.setItem(USER_KEY, JSON.stringify(verifiedUser));
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  initAuth();
}, [piReady]);

  /* ================= LOGIN ================= */

  const pilogin = async () => {
    try {
      setLoading(true);

      const token = await getPiAccessToken();

      if (!token) return;

      const res = await fetch("/api/pi/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok || !data?.user) {
        throw new Error("VERIFY_FAILED");
      }

      const verifiedUser: PiUser = data.user;

      setUser(verifiedUser);
      localStorage.setItem(USER_KEY, JSON.stringify(verifiedUser));
      sessionStorage.removeItem("cart_merged");
      console.log("🟢 LOGIN SUCCESS");
    } catch (err) {
      console.error("❌ LOGIN ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  /* ================= LOGOUT ================= */

  const logout = () => {
  console.log("🔴 LOGOUT");

  // 🧹 clear user
  localStorage.removeItem(USER_KEY);

  // 🧹 clear cart (QUAN TRỌNG)
  localStorage.removeItem("cart");

  // 🧹 reset merge flag
  sessionStorage.removeItem("cart_merged");

  // 🧹 clear Pi token
  clearPiToken();

  setUser(null);
};
  /* ================= PROVIDER ================= */

  return (
    <AuthContext.Provider
      value={{ user, loading, piReady, pilogin, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* ================= HOOK ================= */

export const useAuth = () => useContext(AuthContext);

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { getPiAccessToken } from "@/lib/piAuth";

/* =========================
   TYPES
========================= */
export type PiUser = {
  pi_uid: string;
  username: string;
  wallet_address?: string | null;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [piReady, setPiReady] = useState(false);

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

  useEffect(() => {
    try {
      const rawUser = localStorage.getItem(USER_KEY);
      if (rawUser) {
        setUser(JSON.parse(rawUser));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const pilogin = async () => {
    try {
      setLoading(true);

      const token = await getPiAccessToken();

      const res = await fetch("/api/pi/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok || !data?.success || !data?.user) {
        alert("❌ Pi verify thất bại");
        return;
      }

      const verifiedUser: PiUser = data.user;

      localStorage.setItem(USER_KEY, JSON.stringify(verifiedUser));
      setUser(verifiedUser);
    } catch (err) {
      console.error("❌ Pi login error:", err);
      alert("❌ Lỗi đăng nhập Pi");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, piReady, pilogin, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

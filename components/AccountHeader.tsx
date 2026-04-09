"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { UserCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getPiAccessToken } from "@/lib/piAuth";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import useSWR from "swr";

/* ================= TYPES ================= */

interface Profile {
  avatar?: string | null;
  avatar_url?: string | null;
}

/* ================= FETCHER ================= */

const fetchProfile = async (): Promise<Profile | null> => {
  try {
    const token = await getPiAccessToken();

    const res = await fetch("/api/profile", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return null;

    const raw: unknown = await res.json();

    if (
      typeof raw === "object" &&
      raw !== null &&
      "profile" in raw
    ) {
      const profile = (raw as { profile?: Profile }).profile;
      return profile ?? null;
    }

    return null;
  } catch {
    return null;
  }
};
const fetcher = async (url: string) => {
  const token = await getPiAccessToken();
  if (!token) return null;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;

  return res.json();
};

/* ================= COMPONENT ================= */

export default function AccountHeader() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [avatarCache, setAvatarCache] = useState<string | null>(null);

useEffect(() => {
  const cached = localStorage.getItem("avatar");
  if (cached) setAvatarCache(cached);
}, []);

  const { data } = useSWR(
  user ? "/api/profile" : null,
  fetcher,
  {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  }
);

const profile = data?.profile;
  useEffect(() => {
  if (profile?.avatar_url) {
    setAvatarCache(profile.avatar_url);
    localStorage.setItem("avatar", profile.avatar_url);
  }
}, [profile]);

  const avatar =
  avatarCache ||
  profile?.avatar_url ||
  profile?.avatar ||
  null;

  return (
    <section className="bg-orange-500 text-white p-6 text-center shadow">
      <div className="w-24 h-24 bg-white rounded-full mx-auto overflow-hidden shadow flex items-center justify-center">
        {avatar ? (
          <Image
  src={avatar}
  alt="Avatar"
  width={96}
  height={96}
  priority
  className="object-cover"
/>
        ) : (
          <UserCircle size={56} className="text-orange-500" />
        )}
      </div>

      <p className="mt-3 text-lg font-semibold">
        @{user.username}
      </p>

      <p className="text-xs opacity-90">
        {user.role === "seller"
          ? t.seller
          : user.role === "admin"
          ? t.admin
          : t.customer}
      </p>
    </section>
  );
}

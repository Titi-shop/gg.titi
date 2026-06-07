  "use client";

import Image from "next/image";

import {
  useState,
  useEffect,
} from "react";

import { UserCircle } from "lucide-react";

import useSWR from "swr";

import { useAuth } from "@/context/AuthContext";

import { getPiAccessToken } from "@/lib/piAuth";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* =========================
   TYPES
========================= */

interface Profile {
  avatar?: string | null;
  avatar_url?: string | null;
}

/* =========================
   FETCHER
========================= */

const fetcher = async (
  url: string
) => {
  try {
    const token =
      await getPiAccessToken();

    if (!token) {
      return null;
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return null;
    }

    return res.json();
  } catch {
    return null;
  }
};

/* =========================
   COMPONENT
========================= */

export default function AccountHeader() {
  const { user } =
    useAuth();

  const { t } =
    useTranslation();

  const [
    avatarCache,
    setAvatarCache,
  ] = useState<string | null>(
    null
  );

  /* =========================
     LOAD CACHE
  ========================= */

  useEffect(() => {
    const cached =
      localStorage.getItem(
        "avatar"
      );

    if (cached) {
      setAvatarCache(
        cached
      );
    }
  }, []);

  /* =========================
     PROFILE
  ========================= */

  const { data } = useSWR(
    user
      ? "/api/profile"
      : null,
    fetcher,
    {
      revalidateOnFocus: false,

      dedupingInterval: 10000,
    }
  );

  const profile =
    data?.profile as
      | Profile
      | undefined;

  /* =========================
     UPDATE CACHE
  ========================= */

  useEffect(() => {
    if (
      profile?.avatar_url
    ) {
      setAvatarCache(
        profile.avatar_url
      );

      localStorage.setItem(
        "avatar",
        profile.avatar_url
      );
    }
  }, [profile]);

  /* =========================
     AVATAR
  ========================= */

  const avatar =
    avatarCache ||
    profile?.avatar_url ||
    profile?.avatar ||
    null;

  /* =========================
     ROLE
  ========================= */

  const roleLabel =
    user?.role === "seller"
      ? t.seller
      : user?.role === "admin"
      ? t.admin
      : t.customer;

  /* =========================
     RENDER
  ========================= */

  return (
    <section
      className="
        mx-4
        mt-4
        overflow-hidden
        rounded-3xl
        border
        shadow-sm
        transition-colors
      "
      style={{
        backgroundColor:
          "var(--card-bg)",

        borderColor:
          "var(--border-color)",
      }}
    >
      <div
        className="
          flex
          flex-col
          items-center
          px-6
          py-7
          text-center
        "
      >
        {/* AVATAR */}
        <div
          className="
            flex
            h-24
            w-24
            items-center
            justify-center
            overflow-hidden
            rounded-full
            border
            shadow-sm
          "
          style={{
            backgroundColor:
              "var(--soft-bg)",

            borderColor:
              "var(--border-color)",
          }}
        >
          {avatar ? (
            <Image
              src={avatar}
              alt="Avatar"
              width={96}
              height={96}
              priority
              className="
                h-full
                w-full
                object-cover
              "
            />
          ) : (
            <UserCircle
              size={56}
              style={{
                color:
                  "var(--muted-foreground)",
              }}
            />
          )}
        </div>

        {/* USERNAME */}
        <p
          className="
            mt-4
            text-lg
            font-semibold
          "
          style={{
            color:
              "var(--foreground)",
          }}
        >
          @{user?.username}
        </p>

        {/* ROLE */}
        <div
          className="
            mt-2
            rounded-full
            border
            px-3
            py-1
            text-xs
            font-medium
          "
          style={{
            backgroundColor:
              "var(--soft-bg)",

            borderColor:
              "var(--border-color)",

            color:
              "var(--muted-foreground)",
          }}
        >
          {roleLabel}
        </div>
      </div>
    </section>
  );
}

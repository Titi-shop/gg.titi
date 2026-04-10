"use client";
export const dynamic = "force-dynamic";

import useSWR from "swr";
import { countries } from "@/data/countries";
import { useState } from "react";
import Image from "next/image";
import { Upload, Edit3, Save, X } from "lucide-react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { getPiAccessToken, clearPiToken } from "@/lib/piAuth";

/* ================= TYPES ================= */

interface ProfileData {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;

  country: string;
  province: string | null;
  district: string | null;
  ward: string | null;
  address_line: string | null;
  postal_code: string | null;

  avatar_url: string | null;

  shop_name: string | null;
  shop_slug: string | null;
  shop_description: string | null;
  shop_banner: string | null;
}

const defaultProfile: ProfileData = {
  full_name: null,
  email: null,
  phone: null,
  bio: null,
  country: "",
  province: null,
  district: null,
  ward: null,
  address_line: null,
  postal_code: null,
  avatar_url: null,
  shop_name: null,
  shop_slug: null,
  shop_description: null,
  shop_banner: null,
};

type EditableKey =
  | "full_name"
  | "email"
  | "phone"
  | "bio"
  | "country"
  | "province"
  | "district"
  | "ward"
  | "address_line"
  | "postal_code"
  | "shop_name"
  | "shop_description";

const editableFields: EditableKey[] = [
  "full_name",
  "email",
  "phone",
  "bio",
  "shop_name",
  "shop_description",
  "country",
  "province",
  "district",
  "ward",
  "address_line",
  "postal_code",
];

/* ================= FETCHER ================= */

const fetchProfile = async (): Promise<ProfileData> => {
  const token = await getPiAccessToken();
  if (!token) return defaultProfile;

  let res = await fetch("/api/profile", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401) {
    clearPiToken();
    const newToken = await getPiAccessToken();
    if (!newToken) return defaultProfile;

    res = await fetch("/api/profile", {
      headers: { Authorization: `Bearer ${newToken}` },
    });
  }

  if (!res.ok) return defaultProfile;

  const raw = await res.json();
  const p = raw?.profile ?? {};

  return {
    full_name: p.full_name ?? null,
    email: p.email ?? null,
    phone: p.phone ?? null,
    bio: p.bio ?? null,
    country: p.country ?? "VN",
    province: p.province ?? null,
    district: p.district ?? null,
    ward: p.ward ?? null,
    address_line: p.address_line ?? null,
    postal_code: p.postal_code ?? null,
    avatar_url: p.avatar_url ?? null,
    shop_name: p.shop_name ?? null,
    shop_slug: p.shop_slug ?? null,
    shop_description: p.shop_description ?? null,
    shop_banner: p.shop_banner ?? null,
  };
};

/* ================= COMPONENT ================= */

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const {
    data: profile = defaultProfile,
    isLoading,
    mutate,
  } = useSWR(user ? "/api/profile" : null, fetchProfile);

  const [form, setForm] = useState<ProfileData>(defaultProfile);
  const [editMode, setEditMode] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* sync form when load */
  if (!editMode && form.full_name !== profile.full_name) {
    setForm(profile);
  }

  /* ================= AVATAR ================= */

  const handleAvatarChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!user) return;

    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);

    try {
      const token = await getPiAccessToken();
      if (!token) return;

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/uploadAvatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error();

      const data = await res.json();

      const avatarUrl = data.avatar || data.url;

     mutate(
     (prev: ProfileData) => ({
    ...prev,
    avatar_url: avatarUrl,
     }),
     false
    );

      setPreview(null);
      setSuccess(t.profile_avatar_updated);
      setTimeout(() => setSuccess(null), 2000);

    } catch {
      setError(t.upload_failed);
    } finally {
      URL.revokeObjectURL(objectUrl);
      setUploading(false);
    }
  };

  /* ================= SAVE ================= */

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);

    try {
      const token = await getPiAccessToken();
      if (!token) return;

      const res = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error();

      // ✅ update UI ngay
      mutate(form, false);

      setEditMode(false);
      setSuccess(t.saved_successfully);
      setTimeout(() => setSuccess(null), 2000);

    } catch {
      setError(t.save_failed);
    } finally {
      setSaving(false);
    }
  };

  /* ================= RENDER ================= */

  if (isLoading || authLoading) {
    return <p className="p-4 text-center">{t.loading_profile}</p>;
  }

  const profileDialCode =
    countries.find((c) => c.code === profile.country)?.dialCode ?? "";

  const formDialCode =
    countries.find((c) => c.code === form.country)?.dialCode ?? "";

  return (
    <main className="min-h-screen bg-gray-100 pb-28">
      <div className="max-w-md mx-auto mt-10 bg-white rounded-xl shadow p-6">

        {/* AVATAR */}
        <div className="relative w-28 h-28 mx-auto mb-4">
          {preview ? (
            <Image src={preview} alt="Preview" fill className="rounded-full object-cover border-4 border-orange-500" />
          ) : profile.avatar_url ? (
            <Image src={profile.avatar_url} alt="Avatar" fill className="rounded-full object-cover border-4 border-orange-500" />
          ) : (
            <div className="w-28 h-28 rounded-full bg-orange-200 flex items-center justify-center text-4xl font-bold">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
          )}

          <label className="absolute bottom-0 right-0 bg-orange-500 p-2 rounded-full cursor-pointer">
            <Upload size={16} className="text-white" />
            <input type="file" hidden onChange={handleAvatarChange} />
          </label>
        </div>

        <h2 className="text-center font-semibold mb-4">
          @{user?.username}
        </h2>

        {uploading && <p className="text-center text-sm">{t.uploading}</p>}
        {success && <p className="text-center text-green-600 text-sm">✓ {success}</p>}
        {error && <p className="text-center text-red-500 text-sm">{error}</p>}

        {/* INFO */}
        <div className="space-y-3 mt-4">
          {editableFields.map((key) => (
            <div key={key} className="flex justify-between border-b pb-2">
              <span className="text-gray-500">{t[`profile_${key}`]}</span>

              {editMode ? (
                <input
                  className="text-right outline-none"
                  value={(form[key] as string) ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, [key]: e.target.value })
                  }
                />
              ) : (
                <span>{(profile[key] as string) ?? t.profile_not_set}</span>
              )}
            </div>
          ))}
        </div>

        {/* ACTION */}
        <div className="flex justify-center mt-6 gap-3">
          {editMode ? (
            <>
              <button onClick={handleSave} className="btn-orange flex gap-2">
                <Save size={16} /> {saving ? t.saving : t.save}
              </button>

              <button
                onClick={() => {
                  setForm(profile);
                  setEditMode(false);
                }}
                className="bg-gray-300 px-4 py-2 rounded flex gap-2"
              >
                <X size={16} /> {t.cancel}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="btn-orange flex gap-2"
            >
              <Edit3 size={16} /> {t.edit}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

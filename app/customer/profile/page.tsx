"use client";

export const dynamic = "force-dynamic";
import { countries } from "@/data/countries";
import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Upload,
  Edit3,
  Save,
  X,
} from "lucide-react";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import {
  getPiAccessToken,
  clearPiToken,
} from "@/lib/piAuth";

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

/* ================= COMPONENT ================= */

export default function ProfilePage() {
  const { t } = useTranslation();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [profile, setProfile] =
    useState<ProfileData>(
      defaultProfile
    );

  const [form, setForm] =
    useState<ProfileData>(
      defaultProfile
    );

  const [editMode, setEditMode] =
    useState(false);

  const [preview, setPreview] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [success, setSuccess] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  /* ================= LOAD PROFILE ================= */

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;

    const loadProfile = async () => {
      try {
        const token =
          await getPiAccessToken();

        if (!token) return;

        let res = await fetch(
          "/api/profile",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (res.status === 401) {
          clearPiToken();

          const newToken =
            await getPiAccessToken();

          if (!newToken) return;

          res = await fetch(
            "/api/profile",
            {
              headers: {
                Authorization: `Bearer ${newToken}`,
              },
            }
          );
        }

        if (!res.ok) {
          throw new Error();
        }

        const raw =
          await res.json();

        const profileData =
          raw?.profile &&
          typeof raw.profile ===
            "object"
            ? raw.profile
            : null;

        const safeProfile: ProfileData =
          {
            full_name:
              profileData?.full_name ??
              null,

            email:
              profileData?.email ??
              null,

            phone:
              profileData?.phone ??
              null,

            bio:
              profileData?.bio ??
              null,

            country:
              profileData?.country ??
              "VN",

            province:
              profileData?.province ??
              null,

            district:
              profileData?.district ??
              null,

            ward:
              profileData?.ward ??
              null,

            address_line:
              profileData?.address_line ??
              null,

            postal_code:
              profileData?.postal_code ??
              null,

            avatar_url:
              profileData?.avatar_url ??
              null,

            shop_name:
              profileData?.shop_name ??
              null,

            shop_slug:
              profileData?.shop_slug ??
              null,

            shop_description:
              profileData?.shop_description ??
              null,

            shop_banner:
              profileData?.shop_banner ??
              null,
          };

        setProfile(safeProfile);
        setForm(safeProfile);
      } catch {
        setError(
          t.profile_error_loading ??
            "Failed to load profile"
        );
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [authLoading, user, t]);

  /* ================= AVATAR ================= */

  const handleAvatarChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (authLoading || !user) {
      return;
    }

    const file =
      e.target.files?.[0];

    if (!file) return;

    const objectUrl =
      URL.createObjectURL(file);

    setPreview(objectUrl);

    setUploading(true);
    setError(null);

    try {
      const token =
        await getPiAccessToken();

      if (!token) return;

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const res = await fetch(
        "/api/uploadAvatar",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!res.ok) {
        throw new Error();
      }

      const data =
        await res.json();

      setProfile((prev) => ({
        ...prev,
        avatar_url: data.avatar,
      }));

      setForm((prev) => ({
        ...prev,
        avatar_url: data.avatar,
      }));

      localStorage.setItem(
        "avatar",
        data.avatar
      );

      setPreview(null);

      setSuccess(
        t.profile_avatar_updated ??
          "Avatar updated"
      );

      setTimeout(() => {
        setSuccess(null);
      }, 2000);
    } catch {
      setError(
        t.upload_failed ??
          "Upload failed"
      );
    } finally {
      URL.revokeObjectURL(
        objectUrl
      );

      setUploading(false);
    }
  };

  /* ================= SHOP BANNER ================= */

  const handleBannerUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (authLoading || !user) {
      return;
    }

    const file =
      e.target.files?.[0];

    if (!file) return;

    try {
      const token =
        await getPiAccessToken();

      if (!token) return;

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const res = await fetch(
        "/api/uploadShopBanner",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!res.ok) {
        throw new Error();
      }

      const data =
        await res.json();

      setProfile((prev) => ({
        ...prev,
        shop_banner:
          data.banner,
      }));

      setForm((prev) => ({
        ...prev,
        shop_banner:
          data.banner,
      }));
    } catch {
      setError(
        t.upload_failed ??
          "Upload failed"
      );
    }
  };

  /* ================= SAVE ================= */

  const handleSave = async () => {
    if (authLoading || !user) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const token =
        await getPiAccessToken();

      if (!token) return;

      const res = await fetch(
        "/api/profile",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify(
            form
          ),
        }
      );

      if (!res.ok) {
        throw new Error();
      }

      setProfile(form);

      setEditMode(false);

      setSuccess(
        t.saved_successfully ??
          "Saved successfully"
      );

      setTimeout(() => {
        setSuccess(null);
      }, 2000);
    } catch {
      setError(
        t.save_failed ??
          "Save failed"
      );
    } finally {
      setSaving(false);
    }
  };

  /* ================= LOADING ================= */

  if (loading || authLoading) {
    return (
      <main
        className="
          min-h-screen
          flex
          items-center
          justify-center
        "
        style={{
          backgroundColor:
            "var(--background)",
          color:
            "var(--foreground)",
        }}
      >
        {t.loading_profile ??
          "Loading profile..."}
      </main>
    );
  }

  /* ================= HELPERS ================= */

  const profileDialCode =
    countries.find(
      (c) =>
        c.code ===
        profile.country
    )?.dialCode ?? "";

  const formDialCode =
    countries.find(
      (c) =>
        c.code ===
        form.country
    )?.dialCode ?? "";

  /* ================= RENDER ================= */

  return (
    <main
      className="
        min-h-screen
        pb-28
        px-4
        pt-6
      "
      style={{
        backgroundColor:
          "var(--background)",
      }}
    >
      <div
        className="
          mx-auto
          max-w-md
          overflow-hidden
          rounded-3xl
          border
          shadow-sm
        "
        style={{
          backgroundColor:
            "var(--card-bg)",

          borderColor:
            "var(--border-color)",
        }}
      >
        {/* ================= HEADER ================= */}

        <div
          className="
            relative
            px-6
            pb-8
            pt-8
            text-center
          "
          style={{
            background:
              "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
          }}
        >
          {/* AVATAR */}
          <div
            className="
              relative
              mx-auto
              h-28
              w-28
            "
          >
            {preview ? (
              <Image
                src={preview}
                alt="Preview"
                fill
                className="
                  rounded-full
                  border-4
                  border-white
                  object-cover
                  shadow-xl
                "
              />
            ) : profile.avatar_url ? (
              <Image
                src={
                  profile.avatar_url
                }
                alt="Avatar"
                fill
                className="
                  rounded-full
                  border-4
                  border-white
                  object-cover
                  shadow-xl
                "
              />
            ) : (
              <div
                className="
                  flex
                  h-28
                  w-28
                  items-center
                  justify-center
                  rounded-full
                  border-4
                  border-white
                  text-4xl
                  font-bold
                  text-orange-600
                  shadow-xl
                "
                style={{
                  backgroundColor:
                    "#ffffff",
                }}
              >
                {user?.username
                  ?.charAt(0)
                  ?.toUpperCase()}
              </div>
            )}

            {/* UPLOAD */}
            <label
              className="
                absolute
                bottom-0
                right-0
                flex
                h-10
                w-10
                cursor-pointer
                items-center
                justify-center
                rounded-full
                border-2
                border-white
                bg-orange-500
                shadow-lg
                transition
                active:scale-95
              "
            >
              <Upload
                size={18}
                className="text-white"
              />

              <input
                type="file"
                accept="image/*"
                hidden
                onChange={
                  handleAvatarChange
                }
              />
            </label>
          </div>

          {/* USERNAME */}
          <h1
            className="
              mt-4
              text-xl
              font-bold
              text-white
            "
          >
            @{user?.username}
          </h1>

          <p
            className="
              mt-1
              text-sm
              text-orange-100
            "
          >
            {user?.role ===
            "seller"
              ? t.seller
              : user?.role ===
                "admin"
              ? t.admin
              : t.customer}
          </p>
        </div>

        {/* ================= CONTENT ================= */}

        <div className="p-5">
          {/* STATUS */}
          {uploading && (
            <div
              className="
                mb-4
                rounded-2xl
                border
                px-4
                py-3
                text-center
                text-sm
              "
              style={{
                backgroundColor:
                  "var(--soft-bg)",

                borderColor:
                  "var(--border-color)",

                color:
                  "var(--foreground)",
              }}
            >
              {t.uploading ??
                "Uploading..."}
            </div>
          )}

          {success && (
            <div
              className="
                mb-4
                rounded-2xl
                border
                border-green-500/30
                bg-green-500/10
                px-4
                py-3
                text-center
                text-sm
                text-green-500
              "
            >
              ✓ {success}
            </div>
          )}

          {error && (
            <div
              className="
                mb-4
                rounded-2xl
                border
                border-red-500/30
                bg-red-500/10
                px-4
                py-3
                text-center
                text-sm
                text-red-500
              "
            >
              {error}
            </div>
          )}

          {/* SHOP BANNER */}
          {(profile.shop_banner ||
            editMode) && (
            <div className="mb-5">
              <div
                className="
                  mb-2
                  text-sm
                  font-semibold
                "
                style={{
                  color:
                    "var(--foreground)",
                }}
              >
                {t.shop_banner ??
                  "Shop banner"}
              </div>

              <div
                className="
                  overflow-hidden
                  rounded-2xl
                  border
                "
                style={{
                  borderColor:
                    "var(--border-color)",
                }}
              >
                {profile.shop_banner ? (
                  <Image
                    src={
                      profile.shop_banner
                    }
                    alt="Banner"
                    width={1200}
                    height={400}
                    className="
                      h-36
                      w-full
                      object-cover
                    "
                  />
                ) : (
                  <div
                    className="
                      flex
                      h-36
                      items-center
                      justify-center
                    "
                    style={{
                      backgroundColor:
                        "var(--soft-bg)",

                      color:
                        "var(--muted-foreground)",
                    }}
                  >
                    No banner
                  </div>
                )}
              </div>

              {editMode && (
                <label
                  className="
                    mt-3
                    inline-flex
                    cursor-pointer
                    items-center
                    gap-2
                    rounded-2xl
                    bg-orange-500
                    px-4
                    py-2
                    text-sm
                    font-medium
                    text-white
                    shadow-sm
                    transition
                    hover:bg-orange-600
                    active:scale-95
                  "
                >
                  <Upload size={16} />

                  {t.upload_banner ??
                    "Upload banner"}

                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={
                      handleBannerUpload
                    }
                  />
                </label>
              )}
            </div>
          )}

          {/* FORM */}
          <div className="space-y-3">
            {editableFields.map(
              (key) => (
                <div
                  key={key}
                  className="
                    rounded-2xl
                    border
                    p-4
                  "
                  style={{
                    backgroundColor:
                      "var(--soft-bg)",

                    borderColor:
                      "var(--border-color)",
                  }}
                >
                  {/* LABEL */}
                  <div
                    className="
                      mb-2
                      text-xs
                      font-medium
                      uppercase
                      tracking-wide
                    "
                    style={{
                      color:
                        "var(--muted-foreground)",
                    }}
                  >
                    {t[
                      `profile_${key}`
                    ] ?? key}
                  </div>

                  {/* INPUT */}
                  {editMode ? (
                    key ===
                    "country" ? (
                      <select
                        value={
                          form.country
                        }
                        onChange={(
                          e
                        ) =>
                          setForm({
                            ...form,
                            country:
                              e.target
                                .value,
                          })
                        }
                        className="
                          w-full
                          rounded-xl
                          border
                          px-3
                          py-2
                          outline-none
                        "
                        style={{
                          backgroundColor:
                            "var(--card-bg)",

                          borderColor:
                            "var(--border-color)",

                          color:
                            "var(--foreground)",
                        }}
                      >
                        {countries.map(
                          (c) => (
                            <option
                              key={
                                c.code
                              }
                              value={
                                c.code
                              }
                            >
                              {c.name} (
                              {
                                c.dialCode
                              }
                              )
                            </option>
                          )
                        )}
                      </select>
                    ) : key ===
                      "phone" ? (
                      <div
                        className="
                          flex
                          items-center
                          gap-2
                        "
                      >
                        <span
                          className="
                            text-sm
                          "
                          style={{
                            color:
                              "var(--muted-foreground)",
                          }}
                        >
                          {
                            formDialCode
                          }
                        </span>

                        <input
                          value={
                            form.phone ??
                            ""
                          }
                          onChange={(
                            e
                          ) =>
                            setForm({
                              ...form,
                              phone:
                                e
                                  .target
                                  .value,
                            })
                          }
                          className="
                            w-full
                            rounded-xl
                            border
                            px-3
                            py-2
                            outline-none
                          "
                          style={{
                            backgroundColor:
                              "var(--card-bg)",

                            borderColor:
                              "var(--border-color)",

                            color:
                              "var(--foreground)",
                          }}
                        />
                      </div>
                    ) : (
                      <input
                        value={
                          (form[
                            key
                          ] as string) ??
                          ""
                        }
                        onChange={(
                          e
                        ) =>
                          setForm({
                            ...form,
                            [key]:
                              e
                                .target
                                .value,
                          })
                        }
                        className="
                          w-full
                          rounded-xl
                          border
                          px-3
                          py-2
                          outline-none
                        "
                        style={{
                          backgroundColor:
                            "var(--card-bg)",

                          borderColor:
                            "var(--border-color)",

                          color:
                            "var(--foreground)",
                        }}
                      />
                    )
                  ) : (
                    <div
                      className="
                        text-sm
                        font-medium
                      "
                      style={{
                        color:
                          "var(--foreground)",
                      }}
                    >
                      {key ===
                      "phone"
                        ? profile.phone
                          ? `${profileDialCode} ${profile.phone}`
                          : t.profile_not_set
                        : key ===
                          "country"
                        ? countries.find(
                            (c) =>
                              c.code ===
                              profile.country
                          )?.name ??
                          t.profile_not_set
                        : (profile[
                            key
                          ] as string) ??
                          t.profile_not_set}
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          {/* ACTIONS */}
          <div
            className="
              mt-6
              flex
              gap-3
            "
          >
            {editMode ? (
              <>
                <button
                  onClick={
                    handleSave
                  }
                  disabled={saving}
                  className="
                    flex-1
                    rounded-2xl
                    bg-orange-500
                    px-4
                    py-3
                    font-semibold
                    text-white
                    shadow-sm
                    transition
                    hover:bg-orange-600
                    active:scale-95
                    disabled:opacity-60
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      justify-center
                      gap-2
                    "
                  >
                    <Save size={18} />

                    {saving
                      ? t.saving
                      : t.save}
                  </div>
                </button>

                <button
                  onClick={() => {
                    setForm(profile);
                    setEditMode(false);
                  }}
                  className="
                    flex-1
                    rounded-2xl
                    border
                    px-4
                    py-3
                    font-semibold
                    transition
                    active:scale-95
                  "
                  style={{
                    backgroundColor:
                      "var(--soft-bg)",

                    borderColor:
                      "var(--border-color)",

                    color:
                      "var(--foreground)",
                  }}
                >
                  <div
                    className="
                      flex
                      items-center
                      justify-center
                      gap-2
                    "
                  >
                    <X size={18} />

                    {t.cancel}
                  </div>
                </button>
              </>
            ) : (
              <button
                onClick={() =>
                  setEditMode(true)
                }
                className="
                  flex
                  w-full
                  items-center
                  justify-center
                  gap-2
                  rounded-2xl
                  bg-orange-500
                  px-4
                  py-3
                  font-semibold
                  text-white
                  shadow-sm
                  transition
                  hover:bg-orange-600
                  active:scale-95
                "
              >
                <Edit3 size={18} />

                {t.edit}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

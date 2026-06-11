"use client";

import useSWR from "swr";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { countries } from "@/data/countries";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { getPiAccessToken } from "@/lib/piAuth";
import { useAuth } from "@/context/AuthContext";

import AddressForm, {
  AddressFormData,
} from "@/components/address/AddressForm";

/* ================= TYPES ================= */

interface Address {
  id: string;
  full_name: string;
  phone: string;

  country: string;
  region: string;
  district?: string;
  ward?: string;

  address_line: string;
  postal_code?: string;

  label: "home" | "office" | "other";

  is_default: boolean;
  is_verified?: boolean;

  latitude?: number;
  longitude?: number;
  place_id?: string;
}

interface ApiResponse {
  items: Address[];
}

/* ================= FETCHER ================= */

const fetcher = async (): Promise<ApiResponse> => {
  const token = await getPiAccessToken();

  const res = await fetch("/api/address", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("FETCH_FAILED");
  }

  return res.json();
};

/* ================= PAGE ================= */

export default function CustomerAddressPage() {
  const { t } = useTranslation();

  const router = useRouter();

  const { user } = useAuth();

  const { data, mutate, isLoading } = useSWR(
    user ? "/api/address" : null,
    fetcher
  );

  const [showForm, setShowForm] = useState(false);

  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [form, setForm] =
    useState<AddressFormData>({
      full_name: "",
      phone: "",
      country: "",
      region: "",
      district: "",
      ward: "",
      address_line: "",
      postal_code: "",
    });

  const addresses = data?.items ?? [];

  /* ================= HELPERS ================= */

  const getCountryDisplay = (code: string) => {
    const c = countries.find(
      (x) => x.code === code
    );

    return c
      ? `${c.flag} ${c.name}`
      : code;
  };

  /* ================= EDIT ================= */

  const handleEdit = (a: Address) => {
    setForm({
      full_name: a.full_name,
      phone: a.phone,

      country: a.country,
      region: a.region || "",
      district: a.district || "",
      ward: a.ward || "",

      address_line: a.address_line,
      postal_code: a.postal_code || "",
    });

    setEditingId(a.id);

    setShowForm(true);
  };

  /* ================= SAVE ================= */

  const handleSave = async () => {
    setSaving(true);

    try {
      const token = await getPiAccessToken();

      await fetch("/api/address", {
        method: editingId
          ? "PATCH"
          : "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          ...form,
          id: editingId,
        }),
      });

      await mutate();

      setShowForm(false);

      setEditingId(null);

      setForm({
        full_name: "",
        phone: "",

        country: "",
        region: "",
        district: "",
        ward: "",

        address_line: "",
        postal_code: "",
      });
    } finally {
      setSaving(false);
    }
  };

  /* ================= DEFAULT ================= */

  const setDefault = async (id: string) => {
    const token = await getPiAccessToken();

    await fetch("/api/address", {
      method: "PUT",

      headers: {
        "Content-Type":
          "application/json",

        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify({ id }),
    });

    mutate();
  };

  /* ================= DELETE ================= */

  const deleteAddress = async (
    id: string
  ) => {
    if (
      !confirm(
        t.confirm_delete || "Delete?"
      )
    ) {
      return;
    }

    const token = await getPiAccessToken();

    await fetch(`/api/address?id=${id}`, {
      method: "DELETE",

      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    mutate();
  };

  /* ================= UI ================= */

  return (
    <main
      className="
        min-h-screen
        bg-[var(--background)]
        text-[var(--foreground)]
        pb-28
        transition-colors duration-300
      "
    >
      {/* HEADER */}
      <div
        className="
          fixed top-0 inset-x-0 z-20
          border-b border-orange-500/10
          bg-[var(--nav-bg)]
          backdrop-blur
        "
      >
        <div
          className="
            mx-auto flex max-w-md items-center
            px-4 py-3
          "
        >
          <button
            onClick={() => router.back()}
            className="
              text-xl
              text-[var(--foreground)]
            "
          >
            ←
          </button>

          <h1
            className="
              flex-1 text-center
              font-semibold
              text-[var(--foreground)]
            "
          >
            {t.shipping_address}
          </h1>

          <div className="w-6" />
        </div>
      </div>

      {/* LIST */}
      <div
        className="
          mx-auto max-w-md
          space-y-4
          px-4 pt-20
        "
      >
        {isLoading ? (
          <div
            className="
              rounded-2xl
              border border-orange-500/10
              bg-[var(--card-bg)]
              p-6
              text-center
              text-sm
              text-[var(--text-muted)]
            "
          >
            {t.loading}
          </div>
        ) : addresses.length === 0 ? (
          <div
            className="
              rounded-2xl
              border border-orange-500/10
              bg-[var(--card-bg)]
              p-6
              text-center
              text-sm
              text-[var(--text-muted)]
            "
          >
            {t.no_address}
          </div>
        ) : (
          addresses.map((a) => (
            <div
              key={a.id}
              className={`
                rounded-2xl
                border
                bg-[var(--card-bg)]
                p-4
                shadow-sm
                transition-colors duration-300

                ${
                  a.is_default
                    ? `
                      border-orange-500
                      ring-1 ring-orange-500/30
                    `
                    : `
                      border-orange-500/10
                    `
                }
              `}
            >
              {/* NAME */}
              <div
                className="
                  flex items-center
                  justify-between gap-2
                "
              >
                <p
                  className="
                    font-semibold
                    text-[var(--foreground)]
                  "
                >
                  {a.full_name}
                </p>

                {a.is_default && (
                  <span
                    className="
                      rounded-full
                      border border-orange-500/30
                      bg-orange-500/10
                      px-2 py-1
                      text-xs font-medium
                      text-orange-500
                    "
                  >
                    {t.default ?? "Default"}
                  </span>
                )}
              </div>

              {/* PHONE */}
              <p
                className="
                  mt-1 text-sm
                  text-[var(--text-muted)]
                "
              >
                {a.phone}
              </p>

              {/* ADDRESS */}
              <p
                className="
                  mt-3 text-sm
                  text-[var(--foreground)]
                "
              >
                {a.address_line}
              </p>

              <p
                className="
                  mt-1 text-sm
                  text-[var(--text-muted)]
                "
              >
                {[a.ward, a.district, a.region]
                  .filter(Boolean)
                  .join(", ")}
              </p>

              <p
                className="
                  mt-1 text-sm
                  text-[var(--text-muted)]
                "
              >
                {getCountryDisplay(a.country)}

                {a.postal_code
                  ? ` · ${a.postal_code}`
                  : ""}
              </p>

              {/* ACTIONS */}
              <div
                className="
                  mt-4 flex flex-wrap
                  gap-2
                "
              >
                <button
                  onClick={() =>
                    handleEdit(a)
                  }
                  className="
                    rounded-xl
                    border border-orange-500/20
                    bg-[var(--card-secondary)]
                    px-3 py-2
                    text-sm
                    text-[var(--foreground)]
                  "
                >
                  ✏️ {t.edit}
                </button>

                {!a.is_default && (
                  <button
                    onClick={() =>
                      setDefault(a.id)
                    }
                    className="
                      rounded-xl
                      border border-orange-500/30
                      bg-orange-500/10
                      px-3 py-2
                      text-sm
                      text-orange-500
                    "
                  >
                    ⭐ {t.set_default}
                  </button>
                )}

                <button
                  onClick={() =>
                    deleteAddress(a.id)
                  }
                  className="
                    rounded-xl
                    border border-red-500/20
                    bg-red-500/10
                    px-3 py-2
                    text-sm
                    text-red-500
                  "
                >
                  {t.delete}
                </button>
              </div>
            </div>
          ))
        )}

        {/* ADD BUTTON */}
        <button
          onClick={() => {
            setEditingId(null);

            setForm({
              full_name: "",
              phone: "",

              country: "",
              region: "",
              district: "",
              ward: "",

              address_line: "",
              postal_code: "",
            });

            setShowForm(true);
          }}
          className="
            w-full rounded-2xl
            border border-dashed
            border-orange-500/40
            bg-[var(--card-bg)]
            py-3
            font-medium
            text-orange-500
          "
        >
          + {t.add_address}
        </button>
      </div>

      {/* FORM */}
      {showForm && (
        <>
          {/* OVERLAY */}
          <div
            className="
              fixed inset-0 z-40
              bg-black/50
              backdrop-blur-sm
            "
            onClick={() =>
              setShowForm(false)
            }
          />

          {/* SHEET */}
          <div
            className="
              fixed bottom-0 left-0 right-0
              z-50
              flex h-[85vh]
              flex-col
              rounded-t-3xl
              border-t border-orange-500/20
              bg-[var(--card-bg)]
            "
          >
            <div
              className="
                mx-auto mt-3 mb-2
                h-1.5 w-14
                rounded-full
                bg-orange-500/30
              "
            />

            <div
              className="
                flex-1 overflow-y-auto
                pb-32
              "
            >
              <AddressForm
                form={form}
                setForm={setForm}
                onSubmit={handleSave}
                saving={saving}
              />
            </div>
          </div>
        </>
      )}
    </main>
  );
                }

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
  province: string;
  district?: string;
  ward?: string;
  address_line: string;
  postal_code?: string;
  is_default: boolean;
}

interface ApiResponse {
  items: Address[];
}

/* ================= FETCHER ================= */

const fetcher = async (): Promise<ApiResponse> => {
  const token = await getPiAccessToken();

  const res = await fetch("/api/address", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error("FETCH_FAILED");

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
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<AddressFormData>({
    full_name: "",
    phone: "",
    country: "",
    province: "",
    district: "",
    ward: "",
    address_line: "",
    postal_code: "",
  });

  const addresses = data?.items ?? [];

  /* ================= HELPERS ================= */

  const getCountryDisplay = (code: string) => {
    const c = countries.find((x) => x.code === code);
    return c ? `${c.flag} ${c.name}` : code;
  };

  /* ================= EDIT ================= */

  const handleEdit = (a: Address) => {
    setForm({
      full_name: a.full_name,
      phone: a.phone,
      country: a.country,
      province: a.province || "",
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
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
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
        province: "",
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
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id }),
    });

    mutate();
  };

  /* ================= DELETE ================= */

  const deleteAddress = async (id: string) => {
    if (!confirm(t.confirm_delete || "Delete?")) return;

    const token = await getPiAccessToken();

    await fetch(`/api/address?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    mutate();
  };

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-100 pb-28">

      {/* HEADER */}
      <div className="fixed top-0 inset-x-0 bg-white border-b z-20">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center">
          <button onClick={() => router.back()}>←</button>
          <h1 className="flex-1 text-center font-semibold">
            {t.shipping_address}
          </h1>
        </div>
      </div>

      {/* LIST */}
      <div className="max-w-md mx-auto px-4 pt-20 space-y-4">

        {isLoading ? (
          <p className="text-center text-gray-400">{t.loading}</p>
        ) : addresses.length === 0 ? (
          <p className="text-center text-gray-400">
            {t.no_address}
          </p>
        ) : (
          addresses.map((a) => (
            <div
              key={a.id}
              className={`bg-white p-4 rounded-xl shadow border ${
                a.is_default ? "border-orange-500" : "border-gray-200"
              }`}
            >
              <p className="font-semibold">{a.full_name}</p>
              <p className="text-sm">{a.phone}</p>

              <p className="text-sm text-gray-500 mt-1">
                {a.address_line}
              </p>

              <p className="text-sm text-gray-500">
                {a.province} - {getCountryDisplay(a.country)}
              </p>

              <div className="flex gap-4 mt-3 text-sm">

                <button
                  onClick={() => handleEdit(a)}
                  className="text-blue-600"
                >
                  ✏️ {t.edit}
                </button>

                {!a.is_default && (
                  <button
                    onClick={() => setDefault(a.id)}
                    className="text-orange-600"
                  >
                    ⭐ {t.set_default}
                  </button>
                )}

                <button
                  onClick={() => deleteAddress(a.id)}
                  className="text-red-500"
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
              province: "",
              district: "",
              ward: "",
              address_line: "",
              postal_code: "",
            });
            setShowForm(true);
          }}
          className="w-full py-3 border-dashed border-2 border-orange-400 text-orange-600 rounded-xl"
        >
          {t.add_address}
        </button>
      </div>

      {/* FORM */}
      {showForm && (
        <>
          {/* overlay */}
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setShowForm(false)}
          />

          {/* bottom sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl h-[85vh] flex flex-col">

            <div className="flex-1 overflow-y-auto pb-32">
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

"use client";

export const dynamic = "force-dynamic";

import useSWR from "swr";
import { useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { countries } from "@/data/countries";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useAuth } from "@/context/AuthContext";

/* ================= TYPES ================= */

interface Address {
  id: string;
  full_name: string;
  phone: string;
  country: string;
  province: string;
  address_line: string;
  postal_code?: string;
  is_default: boolean;
}

const emptyForm = {
  full_name: "",
  phone: "",
  country: "VN",
  province: "",
  address_line: "",
  postal_code: "",
};

/* ================= FETCHER ================= */

const fetcher = async (url: string): Promise<Address[]> => {
  const res = await apiAuthFetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.items || [];
};

/* ================= PAGE ================= */

export default function CustomerAddressPage() {

  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();

  /* ================= SWR ================= */

  const {
    data: addresses = [],
    isLoading,
    mutate,
  } = useSWR(user ? "/api/address" : null, fetcher);

  /* ================= STATE ================= */

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  /* ================= HELPERS ================= */

  const getCountryDisplay = (code: string) => {
    const found = countries.find((c) => c.code === code);
    return found ? `${found.flag} ${found.name}` : code;
  };

  /* ================= ACTIONS ================= */

  const handleEdit = (addr: Address) => {
    setForm({
      full_name: addr.full_name,
      phone: addr.phone,
      country: addr.country,
      province: addr.province,
      address_line: addr.address_line,
      postal_code: addr.postal_code || "",
    });

    setEditingId(addr.id);
    setShowForm(true);
  };

  const handleSave = async () => {

    if (!form.full_name || !form.phone || !form.country || !form.province || !form.address_line) {
      setMessage("⚠️ " + t.fill_all_fields);
      return;
    }

    try {

      setSaving(true);

      await apiAuthFetch("/api/address", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({
          ...form,
          id: editingId,
        }),
      });

      await mutate();

      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);

      setMessage("✅ " + (editingId ? t.updated : t.address_saved));

    } finally {

      setSaving(false);

    }
  };

  const setDefault = async (id: string) => {

    await apiAuthFetch("/api/address", {
      method: "PUT",
      body: JSON.stringify({ id }),
    });

    mutate();
  };

  const deleteAddress = async (id: string) => {

    if (!confirm(t.confirm_delete || "Delete this address?")) return;

    await apiAuthFetch(`/api/address?id=${id}`, {
      method: "DELETE",
    });

    mutate();
  };

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-100 pb-28">

      {/* HEADER */}
      <div className="fixed top-0 inset-x-0 bg-white border-b z-20">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-orange-600 font-bold">←</button>
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
            {t.no_address || "No address"}
          </p>
        ) : (
          addresses.map((a) => (
            <div
              key={a.id}
              className={`rounded-xl bg-white p-4 shadow border ${
                a.is_default ? "border-orange-500" : "border-gray-200"
              }`}
            >
              <div className="flex justify-between">
                <div>
                  <p className="font-semibold">{a.full_name}</p>
                  <p className="text-sm text-gray-600">{a.phone}</p>
                  <p className="text-sm text-gray-500 mt-1">{a.address_line}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {a.province} – {getCountryDisplay(a.country)}
                  </p>
                </div>

                {a.is_default && (
                  <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full">
                    {t.default}
                  </span>
                )}
              </div>

              <div className="flex gap-4 mt-3 text-sm">

                <button
                  onClick={() => handleEdit(a)}
                  className="text-blue-500"
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
            setForm(emptyForm);
            setEditingId(null);
            setShowForm(true);
          }}
          className="w-full py-3 border-2 border-dashed border-orange-400 rounded-xl text-orange-600 font-semibold bg-white"
        >
          {t.add_address}
        </button>

        {message && (
          <p className="text-center text-sm text-gray-500">
            {message}
          </p>
        )}
      </div>

      {/* OVERLAY */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setShowForm(false)}
        />
      )}

      {/* FORM */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl transition ${
          showForm ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="p-4 space-y-3">

          <h2 className="text-center font-semibold">
            {editingId ? t.edit_address : t.add_address}
          </h2>

          <input
            className="w-full border p-2 rounded"
            placeholder={t.full_name}
            value={form.full_name}
            onChange={(e) =>
              setForm({ ...form, full_name: e.target.value })
            }
          />

          <input
            className="w-full border p-2 rounded"
            placeholder={t.phone_number}
            value={form.phone}
            onChange={(e) =>
              setForm({ ...form, phone: e.target.value })
            }
          />

          <textarea
            className="w-full border p-2 rounded"
            placeholder={t.address}
            value={form.address_line}
            onChange={(e) =>
              setForm({ ...form, address_line: e.target.value })
            }
          />

          <input
            className="w-full border p-2 rounded"
            placeholder={t.province_city}
            value={form.province}
            onChange={(e) =>
              setForm({ ...form, province: e.target.value })
            }
          />

          <select
            className="w-full border p-2 rounded"
            value={form.country}
            onChange={(e) =>
              setForm({ ...form, country: e.target.value })
            }
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>

          <input
            className="w-full border p-2 rounded"
            placeholder={t.postal_code_optional}
            value={form.postal_code}
            onChange={(e) =>
              setForm({ ...form, postal_code: e.target.value })
            }
          />

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-orange-500 text-white py-2 rounded"
          >
            {saving
              ? t.saving
              : editingId
              ? t.update_address
              : t.save_address}
          </button>
        </div>
      </div>
    </main>
  );
}

"use client";

export const dynamic = "force-dynamic";

import useSWR from "swr";
import { useState } from "react";
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
  district?: string;
  ward?: string;
  address_line: string;
  postal_code?: string;
  is_default: boolean;
}

const emptyForm = {
  full_name: "",
  phone: "",
  country: "VN",

  province: "",
  provinceCode: "",
  district: "",
  districtCode: "",
  ward: "",

  address_line: "",
  postal_code: "",
};

/* ================= FETCHERS ================= */

const fetcher = (url: string) => fetch(url).then(r => r.json());

const addressFetcher = async (url: string) => {
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
  } = useSWR(user ? "/api/address" : null, addressFetcher);

  /* ================= STATE ================= */

  const [form, setForm] = useState<any>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  /* ================= LOCATION SWR ================= */

  const isVN = form.country === "VN";

  const { data: provinces = [] } = useSWR(
    isVN ? "/api/location/provinces" : null,
    fetcher
  );

  const { data: districts = [] } = useSWR(
    isVN && form.provinceCode
      ? `/api/location/districts?provinceCode=${form.provinceCode}`
      : null,
    fetcher
  );

  const { data: wards = [] } = useSWR(
    isVN && form.districtCode
      ? `/api/location/wards?districtCode=${form.districtCode}`
      : null,
    fetcher
  );

  /* ================= ACTIONS ================= */

  const handleEdit = (a: Address) => {
    setForm({
      ...a,
      provinceCode: "",
      districtCode: "",
    });

    setEditingId(a.id);
    setShowForm(true);
  };

  const handleSave = async () => {

    if (!form.full_name || !form.phone || !form.country || !form.address_line) {
      setMessage("⚠️ " + (t.fill_all_fields || "Fill all fields"));
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
    if (!confirm(t.confirm_delete || "Delete?")) return;

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
        ) : (
          addresses.map((a: Address) => (
            <div key={a.id} className="bg-white p-4 rounded-xl shadow">

              <p className="font-semibold">{a.full_name}</p>
              <p className="text-sm">{a.phone}</p>
              <p className="text-sm text-gray-500">{a.address_line}</p>

              <div className="flex gap-3 mt-3 text-sm">
                <button onClick={() => handleEdit(a)}>✏️ {t.edit}</button>
                {!a.is_default && (
                  <button onClick={() => setDefault(a.id)}>⭐ {t.set_default}</button>
                )}
                <button onClick={() => deleteAddress(a.id)} className="text-red-500">
                  {t.delete}
                </button>
              </div>
            </div>
          ))
        )}

        <button
          onClick={() => {
            setForm(emptyForm);
            setEditingId(null);
            setShowForm(true);
          }}
          className="w-full border-dashed border-2 border-orange-400 py-3 rounded-xl"
        >
          {t.add_address}
        </button>

        {message && <p className="text-center text-sm">{message}</p>}
      </div>

      {/* OVERLAY */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowForm(false)} />
      )}

      {/* FORM */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl transition ${
          showForm ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ height: "85vh" }}
      >

        <div className="px-4 overflow-y-auto h-full pb-32 pt-4 space-y-3">

          {/* COUNTRY */}
          <select
            className="w-full border p-2 rounded"
            value={form.country}
            onChange={(e) =>
              setForm({
                ...form,
                country: e.target.value,
                province: "",
                district: "",
                ward: "",
              })
            }
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>

          {/* VN */}
          {isVN ? (
            <>
              <select
                className="w-full border p-2 rounded"
                value={form.provinceCode || ""}
                onChange={(e) => {
                  const selected = provinces.find((p: any) => p.code == e.target.value);
                  setForm({
                    ...form,
                    province: selected?.name,
                    provinceCode: selected?.code,
                    district: "",
                    districtCode: "",
                    ward: "",
                  });
                }}
              >
                <option>Chọn tỉnh</option>
                {provinces.map((p: any) => (
                  <option key={p.code} value={p.code}>{p.name}</option>
                ))}
              </select>

              <select
                className="w-full border p-2 rounded"
                value={form.districtCode || ""}
                onChange={(e) => {
                  const selected = districts.find((d: any) => d.code == e.target.value);
                  setForm({
                    ...form,
                    district: selected?.name,
                    districtCode: selected?.code,
                    ward: "",
                  });
                }}
              >
                <option>Chọn huyện</option>
                {districts.map((d: any) => (
                  <option key={d.code} value={d.code}>{d.name}</option>
                ))}
              </select>

              <select
                className="w-full border p-2 rounded"
                value={form.ward || ""}
                onChange={(e) => {
                  const selected = wards.find((w: any) => w.code == e.target.value);
                  setForm({
                    ...form,
                    ward: selected?.name,
                  });
                }}
              >
                <option>Chọn xã</option>
                {wards.map((w: any) => (
                  <option key={w.code} value={w.code}>{w.name}</option>
                ))}
              </select>
            </>
          ) : (
            <>
              <input
                className="w-full border p-2 rounded"
                placeholder="State"
                value={form.province}
                onChange={(e) =>
                  setForm({ ...form, province: e.target.value })
                }
              />

              <input
                className="w-full border p-2 rounded"
                placeholder="City"
                value={form.district}
                onChange={(e) =>
                  setForm({ ...form, district: e.target.value })
                }
              />
            </>
          )}

          <textarea
            className="w-full border p-2 rounded"
            placeholder="Address"
            value={form.address_line}
            onChange={(e) =>
              setForm({ ...form, address_line: e.target.value })
            }
          />

          <input
            className="w-full border p-2 rounded"
            placeholder="Postal code"
            value={form.postal_code}
            onChange={(e) =>
              setForm({ ...form, postal_code: e.target.value })
            }
          />

        </div>

        {/* SAVE BUTTON */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t p-4 pb-[env(safe-area-inset-bottom)]">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-orange-500 text-white py-3 rounded-xl"
          >
            {saving ? t.saving : t.save_address}
          </button>
        </div>

      </div>
    </main>
  );
}

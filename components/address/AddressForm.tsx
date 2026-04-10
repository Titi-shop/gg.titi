"use client";

import useSWR from "swr";
import { ChangeEvent } from "react";
import { countries } from "@/data/countries";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* ================= TYPES ================= */

export interface AddressFormData {
  full_name: string;
  phone: string;
  country: string;
  province: string;
  address_line: string;
  postal_code: string;
}

interface Province {
  code: number;
  name: string;
}

interface Props {
  form: AddressFormData;
  setForm: (v: AddressFormData) => void;
  onSubmit: () => void;
  saving: boolean;
}

/* ================= FETCHER ================= */

const fetcher = (url: string): Promise<Province[]> =>
  fetch(url).then((r) => r.json());

/* ================= COMPONENT ================= */

export default function AddressForm({
  form,
  setForm,
  onSubmit,
  saving,
}: Props) {
  const { t } = useTranslation();

  const isVN = form.country === "VN";

  /* ================= SWR ================= */

  const { data: provinces } = useSWR<Province[]>(
    isVN ? "https://provinces.open-api.vn/api/p/" : null,
    fetcher
  );

  /* ================= HANDLERS ================= */

  const handleChange =
    (key: keyof AddressFormData) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm({ ...form, [key]: e.target.value });
    };

  const handleCountryChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setForm({
      ...form,
      country: e.target.value,
      province: "",
    });
  };

  const handleProvinceChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setForm({
      ...form,
      province: e.target.value,
    });
  };

  /* ================= VALIDATION ================= */

  const isValid =
    form.full_name &&
    form.phone &&
    form.country &&
    form.address_line &&
    (!isVN || form.province);

  /* ================= UI ================= */

  return (
    <div className="flex flex-col h-full">

      {/* ================= HEADER ================= */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white sticky top-0 z-10">
        <h2 className="font-semibold">
          {t.add_address}
        </h2>

        <button
          onClick={onSubmit}
          disabled={!isValid || saving}
          className="text-orange-500 font-semibold disabled:opacity-50"
        >
          {saving ? t.saving : t.save}
        </button>
      </div>

      {/* ================= FORM ================= */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

        {/* NAME */}
        <input
          className="w-full border p-2 rounded"
          placeholder={t.full_name}
          value={form.full_name}
          onChange={handleChange("full_name")}
        />

        {/* PHONE */}
        <input
          className="w-full border p-2 rounded"
          placeholder={t.phone_number}
          value={form.phone}
          onChange={handleChange("phone")}
        />

        {/* COUNTRY */}
        <select
          className="w-full border p-2 rounded"
          value={form.country}
          onChange={handleCountryChange}
        >
          <option value="">{t.select_country}</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name}
            </option>
          ))}
        </select>

        {/* ================= VN MODE ================= */}
        {isVN ? (
          <select
            className="w-full border p-2 rounded"
            value={form.province}
            onChange={handleProvinceChange}
          >
            <option value="">Tỉnh / Thành</option>
            {provinces?.map((p) => (
              <option key={p.code} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="w-full border p-2 rounded"
            placeholder={t.province_city}
            value={form.province}
            onChange={handleChange("province")}
          />
        )}

        {/* ADDRESS FULL (gộp huyện + xã luôn) */}
        <textarea
          className="w-full border p-2 rounded"
          placeholder={t.address}
          value={form.address_line}
          onChange={handleChange("address_line")}
        />

        {/* POSTAL */}
        <input
          className="w-full border p-2 rounded"
          placeholder={t.postal_code_optional}
          value={form.postal_code}
          onChange={handleChange("postal_code")}
        />

      </div>
    </div>
  );
}

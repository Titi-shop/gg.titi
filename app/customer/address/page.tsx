"use client";

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

interface Props {
  form: AddressFormData;
  setForm: (v: AddressFormData) => void;
  onSubmit: () => void;
  saving: boolean;
}

/* ================= COMPONENT ================= */

export default function AddressForm({
  form,
  setForm,
  onSubmit,
  saving,
}: Props) {
  const { t } = useTranslation();

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

  const isValid =
    form.full_name.trim() &&
    form.phone.trim() &&
    form.country.trim() &&
    form.address_line.trim();

  return (
    <>
      <div className="px-4 overflow-y-auto h-full pb-24 pt-2 space-y-3">

        {/* FULL NAME */}
        <input
          className="w-full border rounded-lg p-2"
          placeholder={t.full_name}
          value={form.full_name}
          onChange={handleChange("full_name")}
        />

        {/* PHONE */}
        <input
          className="w-full border rounded-lg p-2"
          placeholder={t.phone_number}
          value={form.phone}
          onChange={handleChange("phone")}
        />

        {/* ADDRESS */}
        <textarea
          className="w-full border rounded-lg p-2"
          rows={2}
          placeholder={t.address}
          value={form.address_line}
          onChange={handleChange("address_line")}
        />

        {/* PROVINCE / CITY */}
        <input
          className="w-full border rounded-lg p-2"
          placeholder={t.province_city}
          value={form.province}
          onChange={handleChange("province")}
        />

        {/* COUNTRY */}
        <select
          className="w-full border rounded-lg p-2"
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

        {/* POSTAL */}
        <input
          className="w-full border rounded-lg p-2"
          placeholder={t.postal_code_optional}
          value={form.postal_code}
          onChange={handleChange("postal_code")}
        />
      </div>

      {/* FOOTER FIXED */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t p-4">
        <button
          onClick={onSubmit}
          disabled={!isValid || saving}
          className="w-full py-3 rounded-xl bg-orange-600 text-white font-semibold disabled:opacity-50"
        >
          {saving ? t.saving : t.save_address}
        </button>
      </div>
    </>
  );
}

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
  district: string;
  ward: string;
  address_line: string;
  postal_code: string;
}

interface Province {
  code: number;
  name: string;
}

interface District {
  code: number;
  name: string;
}

interface Ward {
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

const fetcher = (url: string) =>
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

  /* ================= SWR CASCADE ================= */

  const { data: provinces } = useSWR<Province[]>(
    isVN ? "https://provinces.open-api.vn/api/p/" : null,
    fetcher
  );

  const { data: districts } = useSWR<District[]>(
    isVN && form.province
      ? `https://provinces.open-api.vn/api/p/${form.province}?depth=2`
      : null,
    fetcher
  );

  const { data: wards } = useSWR<Ward[]>(
    isVN && form.district
      ? `https://provinces.open-api.vn/api/d/${form.district}?depth=2`
      : null,
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
      district: "",
      ward: "",
    });
  };

  const handleProvinceChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setForm({
      ...form,
      province: e.target.value,
      district: "",
      ward: "",
    });
  };

  const handleDistrictChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setForm({
      ...form,
      district: e.target.value,
      ward: "",
    });
  };

  /* ================= VALIDATION ================= */

  const isValid =
    form.full_name &&
    form.phone &&
    form.country &&
    form.address_line &&
    (!isVN || (form.province && form.district && form.ward));

  /* ================= UI ================= */

  return (
    <>
      <div className="px-4 overflow-y-auto h-full pb-40 pt-2 space-y-3">

        <input
          className="w-full border p-2 rounded"
          placeholder={t.full_name}
          value={form.full_name}
          onChange={handleChange("full_name")}
        />

        <input
          className="w-full border p-2 rounded"
          placeholder={t.phone_number}
          value={form.phone}
          onChange={handleChange("phone")}
        />

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
          <>
            <select
              className="w-full border p-2 rounded"
              value={form.province}
              onChange={handleProvinceChange}
            >
              <option value="">Tỉnh / Thành</option>
              {provinces?.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              className="w-full border p-2 rounded"
              value={form.district}
              onChange={handleDistrictChange}
            >
              <option value="">Quận / Huyện</option>
              {districts?.districts?.map((d: any) => (
                <option key={d.code} value={d.code}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              className="w-full border p-2 rounded"
              value={form.ward}
              onChange={(e) =>
                setForm({ ...form, ward: e.target.value })
              }
            >
              <option value="">Phường / Xã</option>
              {wards?.wards?.map((w: any) => (
                <option key={w.code} value={w.code}>
                  {w.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <input
              className="w-full border p-2 rounded"
              placeholder={t.province_city}
              value={form.province}
              onChange={handleChange("province")}
            />
          </>
        )}

        <textarea
          className="w-full border p-2 rounded"
          placeholder={t.address}
          value={form.address_line}
          onChange={handleChange("address_line")}
        />

        <input
          className="w-full border p-2 rounded"
          placeholder={t.postal_code_optional}
          value={form.postal_code}
          onChange={handleChange("postal_code")}
        />
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-white border-t p-4">
        <button
          onClick={onSubmit}
          disabled={!isValid || saving}
          className="w-full py-3 bg-orange-500 text-white rounded disabled:opacity-50"
        >
          {saving ? t.saving : t.save_address}
        </button>
      </div>
    </>
  );
}

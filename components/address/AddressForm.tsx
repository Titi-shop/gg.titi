"use client";

import useSWR from "swr";
import { ChangeEvent } from "react";

import { countries } from "@/data/countries";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* ======================================================
   TYPES
====================================================== */

export interface AddressFormData {
  full_name: string;
  phone: string;

  country: string;

  region: string;
  district: string;
  ward: string;

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

/* ======================================================
   FETCHER
====================================================== */

const fetcher = async (
  url: string
): Promise<Province[]> => {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("FETCH_PROVINCES_FAILED");
  }

  return res.json();
};

/* ======================================================
   COMPONENT
====================================================== */

export default function AddressForm({
  form,
  setForm,
  onSubmit,
  saving,
}: Props) {
  const { t } = useTranslation();

  const isVN = form.country === "VN";

  /* ======================================================
     SWR
  ====================================================== */

  const { data: provinces } = useSWR<Province[]>(
    isVN
      ? "https://provinces.open-api.vn/api/p/"
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  /* ======================================================
     HANDLERS
  ====================================================== */

  const handleChange =
    (key: keyof AddressFormData) =>
    (
      e:
        | ChangeEvent<HTMLInputElement>
        | ChangeEvent<HTMLTextAreaElement>
    ) => {
      setForm({
        ...form,
        [key]: e.target.value,
      });
    };

  const handleCountryChange = (
    e: ChangeEvent<HTMLSelectElement>
  ) => {
    setForm({
      ...form,

      country: e.target.value,

      region: "",
      district: "",
      ward: "",
    });
  };

  const handleRegionChange = (
    e: ChangeEvent<HTMLSelectElement>
  ) => {
    setForm({
      ...form,
      region: e.target.value,
    });
  };

  /* ======================================================
     VALIDATION
  ====================================================== */

  const isValid =
    form.full_name.trim() &&
    form.phone.trim() &&
    form.country.trim() &&
    form.address_line.trim() &&
    (!isVN || form.region.trim());

  /* ======================================================
     INPUT CLASS
  ====================================================== */

  const inputClassName = `
    w-full rounded-2xl
    border border-orange-500/20
    bg-[var(--card-bg)]
    px-4 py-3
    text-sm text-[var(--foreground)]
    outline-none
    transition-colors duration-200

    placeholder:text-[var(--text-muted)]

    focus:border-[var(--color-primary)]
    focus:ring-2 focus:ring-orange-500/10
  `;

  /* ======================================================
     UI
  ====================================================== */

  return (
    <div className="flex h-full flex-col bg-[var(--background)] text-[var(--foreground)]">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div
        className="
          sticky top-0 z-20
          flex items-center justify-between
          border-b border-orange-500/10
          bg-[var(--card-bg)]
          px-4 py-4
          backdrop-blur
        "
      >
        <div>
          <h2 className="text-base font-semibold">
            {t.add_address ?? "Add Address"}
          </h2>

          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {t.shipping_address ??
              "Shipping Address"}
          </p>
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!isValid || saving}
          className="
            rounded-xl
            bg-[var(--color-primary)]
            px-4 py-2
            text-sm font-semibold text-white
            transition-all duration-200

            active:scale-95

            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          {saving
            ? t.saving ?? "Saving..."
            : t.save ?? "Save"}
        </button>
      </div>

      {/* ======================================================
          FORM
      ====================================================== */}

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-32">

        {/* FULL NAME */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t.full_name ?? "Full Name"}
          </label>

          <input
            value={form.full_name}
            onChange={handleChange("full_name")}
            placeholder={
              t.full_name ?? "Full Name"
            }
            className={inputClassName}
          />
        </div>

        {/* PHONE */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t.phone_number ?? "Phone"}
          </label>

          <input
            value={form.phone}
            onChange={handleChange("phone")}
            placeholder={
              t.phone_number ?? "Phone"
            }
            className={inputClassName}
          />
        </div>

        {/* COUNTRY */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t.select_country ?? "Country"}
          </label>

          <select
            value={form.country}
            onChange={handleCountryChange}
            className={inputClassName}
          >
            <option value="">
              {t.select_country ??
                "Select Country"}
            </option>

            {countries.map((country) => (
              <option
                key={country.code}
                value={country.code}
              >
                {country.flag} {country.name}
              </option>
            ))}
          </select>
        </div>

        {/* REGION */}
        <div className="space-y-2">

          <label className="text-sm font-medium">
            {isVN
              ? t.province_city ??
                "Province / City"
              : t.region ?? "Region"}
          </label>

          {isVN ? (
            <select
              value={form.region}
              onChange={handleRegionChange}
              className={inputClassName}
            >
              <option value="">
                {t.province_city ??
                  "Province / City"}
              </option>

              {provinces?.map((province) => (
                <option
                  key={province.code}
                  value={province.name}
                >
                  {province.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={form.region}
              onChange={handleChange("region")}
              placeholder={
                t.province_city ??
                "Province / City"
              }
              className={inputClassName}
            />
          )}
        </div>

        {/* DISTRICT */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t.district ?? "District"}
          </label>

          <input
            value={form.district}
            onChange={handleChange("district")}
            placeholder={
              t.district ?? "District"
            }
            className={inputClassName}
          />
        </div>

        {/* WARD */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t.ward ?? "Ward"}
          </label>

          <input
            value={form.ward}
            onChange={handleChange("ward")}
            placeholder={t.ward ?? "Ward"}
            className={inputClassName}
          />
        </div>

        {/* ADDRESS */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t.address ?? "Address"}
          </label>

          <textarea
            rows={4}
            value={form.address_line}
            onChange={handleChange(
              "address_line"
            )}
            placeholder={
              t.address ?? "Address"
            }
            className={inputClassName}
          />
        </div>

        {/* POSTAL */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t.postal_code_optional ??
              "Postal Code"}
          </label>

          <input
            value={form.postal_code}
            onChange={handleChange(
              "postal_code"
            )}
            placeholder={
              t.postal_code_optional ??
              "Postal Code"
            }
            className={inputClassName}
          />
        </div>

      </div>
    </div>
  );
}

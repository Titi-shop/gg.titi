"use client";

import { useEffect } from "react";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { countries } from "@/data/countries";

/* =========================================================
   TYPES
========================================================= */

type ShippingValue =
  | number
  | string
  | "";

interface ShippingRatesState {
  domestic: ShippingValue;
  sea: ShippingValue;
  asia: ShippingValue;
  europe: ShippingValue;
  north_america: ShippingValue;
  rest_of_world: ShippingValue;
}

interface Props {
  shipping_rates: ShippingRatesState;

  setShipping_rates:
    React.Dispatch<
      React.SetStateAction<ShippingRatesState>
    >;

  domestic_country_code: string;

  setDomestic_country_code: (
    value: string
  ) => void;
}

/* =========================================================
   CONSTANTS
========================================================= */

const MIN_PRICE = 0.00001;

/* =========================================================
   COMPONENT
========================================================= */

export default function ShippingRates({
  shipping_rates,
  setShipping_rates,

  domestic_country_code,
  setDomestic_country_code,
}: Props) {
  const { t } =
    useTranslation();

  /* =========================================================
     DEFAULT COUNTRY
  ========================================================= */

  useEffect(() => {
    if (
      !domestic_country_code
    ) {
      setDomestic_country_code(
        countries[0].code
      );
    }
  }, [
    domestic_country_code,
    setDomestic_country_code,
  ]);

  /* =========================================================
     ZONES
  ========================================================= */

  const zones: {
    key: keyof ShippingRatesState;
    placeholder: string;
  }[] = [
    {
      key: "sea",
      placeholder:
        t.shipping_sea,
    },

    {
      key: "asia",
      placeholder:
        t.shipping_asia,
    },

    {
      key: "europe",
      placeholder:
        t.shipping_europe,
    },

    {
      key: "north_america",
      placeholder:
        t.shipping_north_america,
    },

    {
      key: "rest_of_world",
      placeholder:
        t.shipping_rest_of_world,
    },
  ];

  /* =========================================================
     UPDATE RATE
  ========================================================= */

  const updateRate = (
    key: keyof ShippingRatesState,
    value: string
  ) => {
    setShipping_rates(
      (prev) => ({
        ...prev,

        [key]:
          value === ""
            ? ""
            : value,
      })
    );
  };

  /* =========================================================
     NORMALIZE RATE
  ========================================================= */

  const normalizeRate = (
    key: keyof ShippingRatesState,
    value: ShippingValue
  ) => {
    if (
      value === "" ||
      value === null ||
      value === undefined
    ) {
      setShipping_rates(
        (prev) => ({
          ...prev,

          [key]: "",
        })
      );

      return;
    }

    const parsed =
      Number(value);

    if (
      Number.isNaN(parsed)
    ) {
      setShipping_rates(
        (prev) => ({
          ...prev,

          [key]: "",
        })
      );

      return;
    }

    if (
      parsed > 0 &&
      parsed < MIN_PRICE
    ) {
      setShipping_rates(
        (prev) => ({
          ...prev,

          [key]:
            MIN_PRICE,
        })
      );

      return;
    }

    setShipping_rates(
      (prev) => ({
        ...prev,

        [key]: parsed,
      })
    );
  };

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="space-y-3">
      {/* TITLE */}
      <p className="font-medium">
        {t.shipping_fee}
      </p>

      {/* DOMESTIC */}
      <div className="border rounded-xl p-3 bg-gray-50 space-y-3">
        <select
          value={
            domestic_country_code
          }
          onChange={(e) =>
            setDomestic_country_code(
              e.target.value
            )
          }
          className="border p-2 rounded w-full"
        >
          {countries.map(
            (country) => (
              <option
                key={
                  country.code
                }
                value={
                  country.code
                }
              >
                {
                  country.name
                }
              </option>
            )
          )}
        </select>

        <input
          type="number"
          step="0.00001"
          min={MIN_PRICE}
          inputMode="decimal"
          placeholder={
            t.domestic_price
          }
          value={
            shipping_rates.domestic ===
            0
              ? ""
              : shipping_rates.domestic
          }
          onChange={(e) =>
            updateRate(
              "domestic",
              e.target.value
            )
          }
          onBlur={() =>
            normalizeRate(
              "domestic",
              shipping_rates.domestic
            )
          }
          className="border p-2 rounded w-full"
          required
        />
      </div>

      {/* OPTIONAL ZONES */}
      <div className="grid grid-cols-2 gap-3">
        {zones.map((zone) => (
          <input
            key={zone.key}
            type="number"
            step="0.00001"
            min={MIN_PRICE}
            inputMode="decimal"
            placeholder={
              zone.placeholder
            }
            value={
              shipping_rates[
                zone.key
              ] === 0
                ? ""
                : shipping_rates[
                    zone.key
                  ]
            }
            onChange={(e) =>
              updateRate(
                zone.key,
                e.target.value
              )
            }
            onBlur={() =>
              normalizeRate(
                zone.key,
                shipping_rates[
                  zone.key
                ]
              )
            }
            className="border p-2 rounded w-full"
          />
        ))}
      </div>
    </div>
  );
}

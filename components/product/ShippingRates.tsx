"use client";

import { countries } from "@/data/countries";

interface Props {
  shippingRates: Record<string, number | "">;
  setShippingRates: (v: any) => void;

  primaryShippingCountry: string;
  setPrimaryShippingCountry: (v: string) => void;
}

export default function ShippingRates({
  shippingRates,
  setShippingRates,
  primaryShippingCountry,
  setPrimaryShippingCountry,
}: Props) {
  const zones = [
    { key: "sea", label: "Southeast Asia" },
    { key: "asia", label: "Asia" },
    { key: "europe", label: "Europe" },
    { key: "north_america", label: "North America" },
    { key: "rest_of_world", label: "Rest of World" },
  ];

  return (
    <div className="space-y-3">
      <p className="font-medium">🚚 Shipping Fee</p>

      {/* DOMESTIC */}
      <div className="border rounded-xl p-3 bg-gray-50 space-y-2">
        <p className="text-sm font-medium text-gray-700">
          Domestic Country
        </p>

        <div className="grid grid-cols-2 gap-3">
          <select
       value={primaryShippingCountry}
      onChange={(e) => setPrimaryShippingCountry(e.target.value)}
        />
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>

          <input
            type="number"
            step="0.00001"
            placeholder="Domestic Price"
            value={shippingRates.domestic || ""}
            onChange={(e) => {
              const val = Number(e.target.value);
              setShippingRates((prev: any) => ({
                ...prev,
                domestic: Number.isNaN(val) ? 0 : val,
              }));
            }}
            className="border p-2 rounded"
          />
        </div>
      </div>

      {/* ZONES */}
      <div className="grid grid-cols-2 gap-3">
        {zones.map((z) => (
          <input
  value={shippingRates[z.key] ?? ""}
  onChange={(e) => {
    const val = Number(e.target.value);

    setShippingRates((prev) => ({
      ...prev,
      [z.key]: Number.isNaN(val) ? 0 : val,
    }));
  }}
/>
        ))}
      </div>
    </div>
  );
}

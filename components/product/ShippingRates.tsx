"use client";

export default function ShippingRates({
  shippingRates,
  setShippingRates,
}: any) {
  const zones = [
    { key: "domestic", label: "Domestic" },
    { key: "sea", label: "SEA" },
    { key: "asia", label: "Asia" },
    { key: "europe", label: "Europe" },
    { key: "north_america", label: "North America" },
    { key: "rest_of_world", label: "Rest of World" },
  ];

  console.log("🚚 [UI] shippingRates:", shippingRates);

  return (
    <div className="space-y-2">
      <p className="font-medium">🚚 Shipping Fee</p>

      <div className="grid grid-cols-2 gap-3">
        {zones.map((z) => {
          const value = shippingRates?.[z.key];

          return (
            <input
              key={z.key}
              type="number"
              step="0.00001"
              placeholder={z.label}

              /* ✅ FIX 1: luôn là number */
              value={typeof value === "number" ? value : 0}

              onChange={(e) => {
                const val = Number(e.target.value);

                console.log("✏️ CHANGE:", z.key, val);

                setShippingRates((prev: any) => ({
                  ...prev,
                  [z.key]: Number.isNaN(val) ? 0 : val,
                }));
              }}

              className="border p-2 rounded"
            />
          );
        })}
      </div>
    </div>
  );
}

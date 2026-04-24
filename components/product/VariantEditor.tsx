"use client";

import { ProductVariant } from "./types";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

interface Props {
  variants: ProductVariant[];
  setVariants: (v: ProductVariant[]) => void;
}

export default function VariantEditor({ variants, setVariants }: Props) {
  const { t } = useTranslation();

  const updateVariant = <K extends keyof ProductVariant>(
    index: number,
    key: K,
    value: ProductVariant[K]
  ) => {
    const newVariants = [...variants];
    newVariants[index] = {
      ...newVariants[index],
      [key]: value,
    };
    setVariants(newVariants);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const addVariant = () => {
  setVariants([
    ...variants,
    {
      optionName: "",
      optionValue: "",
      price: null,
      salePrice: null,

      saleEnabled: false,
      saleStock: 0,
      saleSold: 0,
      stock: 0,
      sku: "",
      isActive: true,
    },
  ]);
};

  return (
    <div className="space-y-4">
      <p className="font-semibold text-base">
        {t.variant_title || "Variants"}
      </p>

      {variants.map((v, i) => {
        const isInvalidSale =
  v.saleEnabled &&
  v.salePrice !== null &&
  v.price !== null &&
  v.salePrice >= v.price;

        return (
          <div
            key={i}
            className="bg-white border rounded-xl p-4 shadow-sm space-y-3"
          >
            {/* HEADER */}
            <div className="flex justify-between items-center">
              <div className="text-sm font-medium text-gray-700">
                {v.optionName || t.variant_type}:{" "}
                <span className="text-black">
                  {v.optionValue || t.variant_value}
                </span>
              </div>

              <input
                type="checkbox"
                checked={v.isActive ?? true}
                onChange={(e) =>
                  updateVariant(i, "isActive", e.target.checked)
                }
              />
            </div>

            {/* OPTION */}
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder={t.variant_type_placeholder}
                value={v.optionName || ""}
                onChange={(e) =>
                  updateVariant(i, "optionName", e.target.value)
                }
                className="border p-2 rounded text-sm"
              />

              <input
                placeholder={t.variant_value_placeholder}
                value={v.optionValue}
                onChange={(e) =>
                  updateVariant(i, "optionValue", e.target.value)
                }
                className="border p-2 rounded text-sm"
              />
            </div>

            {/* PRICE */}
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder={t.variant_price}
                value={v.price ?? ""}
                onChange={(e) =>
                  updateVariant(
                    i,
                    "price",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                className="border p-2 rounded text-sm"
              />

              <input
                type="number"
                placeholder={t.variant_sale_price}
                value={v.salePrice ?? ""}
                onChange={(e) =>
                  updateVariant(
                    i,
                    "salePrice",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                className={`border p-2 rounded text-sm ${
                  isInvalidSale ? "border-red-500" : ""
                }`}
              />
            </div>
       {/* 🔥 SALE ENABLE */}
     <div className="flex items-center justify-between">
  <span className="text-sm text-gray-600">
    {t.sale_enable || "Enable Sale"}
  </span>

    <input
    type="checkbox"
    checked={v.saleEnabled ?? false}
    onChange={(e) =>
      updateVariant(i, "saleEnabled", e.target.checked)
    }
        />
         </div>
            {/* ERROR */}
            {isInvalidSale && (
              <p className="text-red-500 text-xs">
                {t.variant_sale_invalid}
              </p>
            )}

            {/* STOCK + SKU */}
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder={t.variant_stock}
                value={v.stock}
                onChange={(e) =>
                  updateVariant(i, "stock", Number(e.target.value))
                }
                className="border p-2 rounded text-sm"
              />

              <input
                placeholder={t.variant_sku}
                value={v.sku || ""}
                onChange={(e) =>
                  updateVariant(i, "sku", e.target.value)
                }
                className="border p-2 rounded text-sm"
              />
            </div>

            {/* DELETE */}
            <button
              type="button"
              onClick={() => removeVariant(i)}
              className="text-red-500 text-sm w-full border border-red-300 rounded py-2 hover:bg-red-50"
            >
              {t.variant_delete}
            </button>
          </div>
        );
      })}

      {/* ADD */}
      <button
        type="button"
        onClick={addVariant}
        className="w-full bg-green-500 text-white py-3 rounded-xl font-medium active:scale-95 transition"
      >
        {t.variant_add}
      </button>
    </div>
  );
}

"use client";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* ================= TYPES ================= */
export interface ProductVariant {
  id?: string;

  option1?: string;
  option2?: string;
  option3?: string;

  optionLabel1?: string;
  optionLabel2?: string;
  optionLabel3?: string;

  name?: string;

  price: number;
  salePrice?: number | null;

  saleEnabled?: boolean;
  saleStock?: number;
  saleSold?: number;

  stock: number;

  sku?: string;
  isActive?: boolean;
}

/* ================= COMPONENT ================= */
export default function VariantEditor({
  variants,
  setVariants,
}: {
  variants: ProductVariant[];
  setVariants: (v: ProductVariant[]) => void;
}) {
  const { t } = useTranslation();

  /* ================= UPDATE ================= */
  const updateVariant = (
    index: number,
    key: keyof ProductVariant,
    value: any
  ) => {
    const newVariants = [...variants];
    newVariants[index] = {
      ...newVariants[index],
      [key]: value,
    };
    setVariants(newVariants);
  };

  /* ================= ADD ================= */
  const addVariant = () => {
    setVariants([
      ...variants,
      {
        option1: "",
        option2: "",
        option3: "",
        optionLabel1: "Color",
        optionLabel2: "Size",
        optionLabel3: "",

        price: 0,
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

  /* ================= DELETE ================= */
  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  /* ================= UI ================= */
  return (
    <div className="space-y-4">

      <p className="font-semibold text-base">
        🧩 {t.variant_title || "Product Variants"}
      </p>

      {variants.map((v, i) => {
        const invalidSale =
          v.salePrice &&
          v.price &&
          v.salePrice >= v.price;

        return (
          <div
            key={i}
            className="bg-white border rounded-xl p-4 shadow-sm space-y-3"
          >
            {/* ===== HEADER ===== */}
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium">
                Variant #{i + 1}
              </p>

              <input
                type="checkbox"
                checked={v.isActive ?? true}
                onChange={(e) =>
                  updateVariant(i, "isActive", e.target.checked)
                }
              />
            </div>

            {/* ===== OPTIONS ===== */}
            <div className="grid grid-cols-3 gap-2">
              <input
                placeholder="Color"
                value={v.option1 || ""}
                onChange={(e) =>
                  updateVariant(i, "option1", e.target.value)
                }
                className="border p-2 rounded text-sm"
              />

              <input
                placeholder="Size"
                value={v.option2 || ""}
                onChange={(e) =>
                  updateVariant(i, "option2", e.target.value)
                }
                className="border p-2 rounded text-sm"
              />

              <input
                placeholder="Material"
                value={v.option3 || ""}
                onChange={(e) =>
                  updateVariant(i, "option3", e.target.value)
                }
                className="border p-2 rounded text-sm"
              />
            </div>

            {/* ===== PRICE ===== */}
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Price"
                value={v.price ?? ""}
                onChange={(e) =>
                  updateVariant(i, "price", Number(e.target.value))
                }
                className="border p-2 rounded text-sm"
              />

              <input
                type="number"
                placeholder="Sale price"
                value={v.salePrice ?? ""}
                onChange={(e) =>
                  updateVariant(
                    i,
                    "salePrice",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                className={`border p-2 rounded text-sm ${
                  invalidSale ? "border-red-500" : ""
                }`}
              />
            </div>

            {invalidSale && (
              <p className="text-red-500 text-xs">
                Sale price must be lower than price
              </p>
            )}

            {/* ===== SALE ENABLE ===== */}
            <label className="flex justify-between items-center border p-2 rounded text-sm">
              <span>🔥 Enable Flash Sale</span>
              <input
                type="checkbox"
                checked={v.saleEnabled || false}
                onChange={(e) =>
                  updateVariant(i, "saleEnabled", e.target.checked)
                }
              />
            </label>

            {/* ===== SALE STOCK ===== */}
            {v.saleEnabled && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Sale stock"
                  value={v.saleStock ?? 0}
                  onChange={(e) =>
                    updateVariant(i, "saleStock", Number(e.target.value))
                  }
                  className="border p-2 rounded text-sm"
                />

                <div className="flex items-center text-xs text-gray-400">
                  🔒 Sold auto ({v.saleSold ?? 0})
                </div>
              </div>
            )}

            {/* ===== STOCK + SKU ===== */}
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Stock"
                value={v.stock}
                onChange={(e) =>
                  updateVariant(i, "stock", Number(e.target.value))
                }
                className="border p-2 rounded text-sm"
              />

              <input
                placeholder="SKU"
                value={v.sku || ""}
                onChange={(e) =>
                  updateVariant(i, "sku", e.target.value)
                }
                className="border p-2 rounded text-sm"
              />
            </div>

            {/* ===== DELETE ===== */}
            <button
              type="button"
              onClick={() => removeVariant(i)}
              className="text-red-500 text-sm w-full border border-red-300 rounded py-2 hover:bg-red-50"
            >
              Delete variant
            </button>
          </div>
        );
      })}

      {/* ===== ADD BUTTON ===== */}
      <button
        type="button"
        onClick={addVariant}
        className="w-full bg-green-500 text-white py-3 rounded-xl font-medium active:scale-95"
      >
        ➕ Add Variant
      </button>
    </div>
  );
}

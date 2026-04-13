"use client";

import { ProductVariant } from "./types";

interface Props {
  variants: ProductVariant[];
  setVariants: (v: ProductVariant[]) => void;
}

export default function VariantEditor({ variants, setVariants }: Props) {

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
        stock: 0,
        sku: "",
        isActive: true,
      },
    ]);
  };

  return (
    <div className="space-y-3">
      <p className="font-semibold">Biến thể sản phẩm</p>

      {variants.map((v, i) => (
        <div
          key={i}
          className="border rounded-lg p-3 space-y-2 bg-gray-50"
        >

          {/* OPTION TYPE */}
          <input
            placeholder="Loại (size / ml / màu...)"
            value={v.optionName}
            onChange={(e) =>
              updateVariant(i, "optionName", e.target.value)
            }
            className="w-full border p-2 rounded"
          />

          {/* VALUE */}
          <input
            placeholder="Giá trị (XL / 10ml / đỏ...)"
            value={v.optionValue}
            onChange={(e) =>
              updateVariant(i, "optionValue", e.target.value)
            }
            className="w-full border p-2 rounded"
          />

          {/* PRICE + STOCK */}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Giá riêng (optional)"
              value={v.price ?? ""}
              onChange={(e) =>
                updateVariant(
                  i,
                  "price",
                  e.target.value ? Number(e.target.value) : null
                )
              }
              className="border p-2 rounded"
            />

            <input
              type="number"
              placeholder="Tồn kho"
              value={v.stock}
              onChange={(e) =>
                updateVariant(i, "stock", Number(e.target.value))
              }
              className="border p-2 rounded"
            />
          </div>

          {/* SKU */}
          <input
            placeholder="SKU"
            value={v.sku || ""}
            onChange={(e) =>
              updateVariant(i, "sku", e.target.value)
            }
            className="w-full border p-2 rounded"
          />

          {/* ACTIVE */}
          <label className="flex items-center justify-between text-sm">
            <span>Active</span>
            <input
              type="checkbox"
              checked={v.isActive ?? true}
              onChange={(e) =>
                updateVariant(i, "isActive", e.target.checked)
              }
            />
          </label>

          {/* REMOVE */}
          <button
            type="button"
            onClick={() => removeVariant(i)}
            className="w-full bg-red-500 text-white py-2 rounded"
          >
            ✕ Xóa biến thể
          </button>
        </div>
      ))}

      {/* ADD */}
      <button
        type="button"
        onClick={addVariant}
        className="w-full bg-green-500 text-white py-2 rounded"
      >
        + Thêm biến thể
      </button>
    </div>
  );
}

"use client";

export default function VariantEditor({
  variants,
  setVariants,
}: any) {
  const updateVariant = (i: number, key: string, value: any) => {
    const newV = [...variants];
    newV[i][key] = value;
    setVariants(newV);
  };

  return (
    <div className="space-y-2">
      <p className="font-medium">Biến thể sản phẩm</p>

      {variants.map((v: any, i: number) => (
        <div key={i} className="grid grid-cols-3 gap-2">
          <input
            placeholder="Size / Phân loại"
            value={v.optionValue}
            onChange={(e) =>
              updateVariant(i, "optionValue", e.target.value)
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

          <input
            placeholder="SKU"
            value={v.sku || ""}
            onChange={(e) =>
              updateVariant(i, "sku", e.target.value)
            }
            className="border p-2 rounded"
          />

          <button
            onClick={() =>
              setVariants((prev: any[]) =>
                prev.filter((_, idx) => idx !== i)
              )
            }
            className="bg-red-500 text-white px-2 py-2 rounded col-span-3"
          >
            ✕ Xóa biến thể
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          setVariants((prev: any[]) => [
            ...prev,
            {
              optionValue: "",
              stock: 0,
              sku: "",
            },
          ])
        }
        className="bg-green-500 text-white px-3 py-2 rounded"
      >
        + Thêm biến thể
      </button>
    </div>
  );
}

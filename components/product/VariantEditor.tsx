"use client";

import { useState } from "react";
import { ProductVariant } from "./types";

interface Props {
  variants: ProductVariant[];
  setVariants: (v: ProductVariant[]) => void;
}

export default function VariantEditor({
  variants,
  setVariants,
}: Props) {
  /* ================= OPTION INPUT ================= */
  const [label1, setLabel1] = useState("Color");
  const [values1, setValues1] = useState("");

  const [label2, setLabel2] = useState("Size");
  const [values2, setValues2] = useState("");

  /* ================= PARSE ================= */
  const parse = (v: string) =>
    v.split(",").map((x) => x.trim()).filter(Boolean);

  /* ================= GENERATE ================= */
  const generateVariants = () => {
    const v1 = parse(values1);
    const v2 = parse(values2);

    const result: ProductVariant[] = [];

    if (v1.length && v2.length) {
      for (const a of v1) {
        for (const b of v2) {
          result.push({
  option_1: a,
  option_2: b,
  option_label_1: label1,
  option_label_2: label2,

  price: 0,
  stock: 0,

  sale_enabled: false,
  sale_stock: 0,

  is_active: true,
       });
        }
      }
    } else if (v1.length) {
      for (const a of v1) {
        result.push({
        option_1: a,
  option_label_1: label1,

  price: 0,
  stock: 0,

  sale_enabled: false,
  sale_stock: 0,

  is_active: true,
     });
      }
    }

    setVariants(result);
  };

  /* ================= UPDATE ================= */
  const update = (
    index: number,
    key: keyof ProductVariant,
    value: any
  ) => {
    const copy = [...variants];
    copy[index] = { ...copy[index], [key]: value };

    /* 🔥 FIX SALE STOCK */
    if (
      key === "saleStock" &&
      copy[index].saleStock! > copy[index].stock
    ) {
      copy[index].saleStock = copy[index].stock;
    }

    /* 🔥 FIX SALE PRICE */
    if (
      key === "salePrice" &&
      copy[index].salePrice! >= (copy[index].price || 0)
    ) {
      copy[index].salePrice = null;
    }

    setVariants(copy);
  };

  /* ================= BULK ================= */
  const bulkSet = (key: keyof ProductVariant, value: any) => {
    setVariants(
      variants.map((v) => ({
        ...v,
        [key]: value,
      }))
    );
  };

  /* ================= DELETE ================= */
  const remove = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  /* ================= UI ================= */
  return (
    <div className="space-y-4">

      <h2 className="font-semibold text-lg">Variants</h2>

      {/* ================= GENERATOR ================= */}
      <div className="border p-3 rounded space-y-2 bg-gray-50">
        <div className="grid grid-cols-2 gap-2">
          <input
            value={label1}
            onChange={(e) => setLabel1(e.target.value)}
            className="border p-2 rounded"
            placeholder="Option 1 (Color)"
          />
          <input
            value={values1}
            onChange={(e) => setValues1(e.target.value)}
            className="border p-2 rounded"
            placeholder="Red, Blue"
          />

          <input
            value={label2}
            onChange={(e) => setLabel2(e.target.value)}
            className="border p-2 rounded"
            placeholder="Option 2 (Size)"
          />
          <input
            value={values2}
            onChange={(e) => setValues2(e.target.value)}
            className="border p-2 rounded"
            placeholder="S, M"
          />
        </div>

        <button
          type="button"
          onClick={generateVariants}
          className="w-full bg-blue-500 text-white py-2 rounded"
        >
          Generate Variants
        </button>
      </div>

      {/* ================= BULK ================= */}
      {variants.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            placeholder="Bulk price"
            onBlur={(e) =>
              bulkSet("price", Number(e.target.value))
            }
            className="border p-2 rounded"
          />

          <input
            type="number"
            placeholder="Bulk stock"
            onBlur={(e) =>
              bulkSet("stock", Number(e.target.value))
            }
            className="border p-2 rounded"
          />

          <button
            type="button"
            onClick={() => bulkSet("saleEnabled", true)}
            className="bg-orange-500 text-white rounded"
          >
            Enable Sale All
          </button>
        </div>
      )}

      {/* ================= TABLE ================= */}
      {variants.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2">Variant</th>
                <th className="p-2">Price</th>
                <th className="p-2">Stock</th>
                <th className="p-2">Sale</th>
                <th className="p-2"></th>
              </tr>
            </thead>

            <tbody>
              {variants.map((v, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">
                    {v.option1} {v.option2 && `- ${v.option2}`}
                  </td>

                  {/* PRICE */}
                  <td className="p-2">
                    <input
                      type="number"
                      value={v.price || 0}
                      onChange={(e) =>
                        update(i, "price", Number(e.target.value))
                      }
                      className="border p-1 w-24"
                    />
                  </td>

                  {/* STOCK */}
                  <td className="p-2">
                    <input
                      type="number"
                      value={v.stock}
                      onChange={(e) =>
                        update(i, "stock", Number(e.target.value))
                      }
                      className="border p-1 w-20"
                    />
                  </td>

                  {/* SALE */}
                  <td className="p-2 space-y-1">
                    <input
                      type="checkbox"
                      checked={v.saleEnabled || false}
                      onChange={(e) =>
                        update(i, "saleEnabled", e.target.checked)
                      }
                    />

                    {v.saleEnabled && (
                      <>
                        <input
                          type="number"
                          placeholder="Sale price"
                          value={v.salePrice || ""}
                          onChange={(e) =>
                            update(
                              i,
                              "salePrice",
                              Number(e.target.value)
                            )
                          }
                          className="border p-1 w-24 block"
                        />

                        <input
                          type="number"
                          placeholder="Sale stock"
                          value={v.saleStock || 0}
                          onChange={(e) =>
                            update(
                              i,
                              "saleStock",
                              Number(e.target.value)
                            )
                          }
                          className="border p-1 w-24 block"
                        />
                      </>
                    )}
                  </td>

                  {/* DELETE */}
                  <td className="p-2">
                    <button
                      onClick={() => remove(i)}
                      className="text-red-500"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

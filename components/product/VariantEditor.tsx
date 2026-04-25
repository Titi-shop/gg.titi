
"use client";

import { useState } from "react";
import { ProductVariant } from "./types";

interface Props {
  variants: ProductVariant[];
  setVariants: (v: ProductVariant[]) => void;
}

/* =========================================================
   CORE TYPE SAFE PARSE
========================================================= */

const parse = (v: string) =>
  v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export default function VariantEditor({
  variants,
  setVariants,
}: Props) {
  /* ================= INPUT ================= */
  const [label1, setLabel1] = useState("Color");
  const [values1, setValues1] = useState("");

  const [label2, setLabel2] = useState("Size");
  const [values2, setValues2] = useState("");

  /* =========================================================
     GENERATE VARIANTS (CORE FIX)
     -> CHUẨN DB FORMAT (option_1, option_label_1)
  ========================================================= */

  const generateVariants = () => {
    const v1 = parse(values1);
    const v2 = parse(values2);

    const result: ProductVariant[] = [];

    if (v1.length && v2.length) {
      for (const a of v1) {
        for (const b of v2) {
          result.push({
            option1: a,
            option2: b,

            optionLabel1: label1,
            optionLabel2: label2,

            price: 0,
            stock: 0,

            saleEnabled: false,
            salePrice: null,
            saleStock: 0,

            isActive: true,
          });
        }
      }
    } else if (v1.length) {
      for (const a of v1) {
        result.push({
          option1: a,

          optionLabel1: label1,

          option2: null,
          optionLabel2: null,

          price: 0,
          stock: 0,

          saleEnabled: false,
          salePrice: null,
          saleStock: 0,

          isActive: true,
        });
      }
    }

    setVariants(result);
  };

  /* =========================================================
     UPDATE SINGLE FIELD (SAFE + FIX SALE LOGIC)
  ========================================================= */

  const update = (
    index: number,
    key: keyof ProductVariant,
    value: any
  ) => {
    const copy = [...variants];
    const v = { ...copy[index], [key]: value };

    /* ================= SALE STOCK RULE ================= */
    if (
      v.saleStock &&
      v.stock &&
      v.saleStock > v.stock
    ) {
      v.saleStock = v.stock;
    }

    /* ================= SALE PRICE RULE ================= */
    if (
      v.salePrice !== null &&
      v.price &&
      v.salePrice >= v.price
    ) {
      v.salePrice = null;
    }

    copy[index] = v;
    setVariants(copy);
  };

  /* =========================================================
     BULK UPDATE
  ========================================================= */

  const bulkSet = (key: keyof ProductVariant, value: any) => {
    setVariants(
      variants.map((v) => ({
        ...v,
        [key]: value,
      }))
    );
  };

  /* =========================================================
     DELETE
  ========================================================= */

  const remove = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="space-y-4">

      <h2 className="font-semibold text-lg">
        Product Variants
      </h2>

      {/* ================= GENERATOR ================= */}
      <div className="border p-3 rounded bg-gray-50 space-y-2">

        <div className="grid grid-cols-2 gap-2">

          <input
            value={label1}
            onChange={(e) => setLabel1(e.target.value)}
            className="border p-2 rounded"
            placeholder="Option 1 label (Color)"
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
            placeholder="Option 2 label (Size)"
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
            className="border p-2 rounded"
            onBlur={(e) =>
              bulkSet("price", Number(e.target.value))
            }
          />

          <input
            type="number"
            placeholder="Bulk stock"
            className="border p-2 rounded"
            onBlur={(e) =>
              bulkSet("stock", Number(e.target.value))
            }
          />

          <button
            type="button"
            className="bg-orange-500 text-white rounded"
            onClick={() => bulkSet("saleEnabled", true)}
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

                  {/* VARIANT NAME */}
                  <td className="p-2">
                    {v.option1}
                    {v.option2 ? ` - ${v.option2}` : ""}
                  </td>

                  {/* PRICE */}
                  <td className="p-2">
                    <input
                      type="number"
                      value={v.price}
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

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={v.saleEnabled}
                        onChange={(e) =>
                          update(i, "saleEnabled", e.target.checked)
                        }
                      />
                      Sale
                    </label>

                    {v.saleEnabled && (
                      <>
                        <input
                          type="number"
                          placeholder="Sale price"
                          value={v.salePrice ?? ""}
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
                          value={v.saleStock}
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

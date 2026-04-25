
"use client";

import { useState } from "react";
import { ProductVariant } from "./types";

/* =========================================================
   TYPES (STRICT SAFE)
========================================================= */

type VariantKey = keyof ProductVariant;

interface Props {
  variants: ProductVariant[];
  setVariants: (v: ProductVariant[]) => void;
}

/* =========================================================
   HELPERS
========================================================= */

const parseInput = (v: string): string[] =>
  v
    .split(",")
    .map((x) => x.trim())
    .filter((x): x is string => x.length > 0);

const makeSku = (a: string, b?: string | null) =>
  `SKU-${a}${b ? `-${b}` : ""}`
    .toUpperCase()
    .replace(/\s+/g, "-");

/* =========================================================
   COMPONENT
========================================================= */

export default function VariantEditor({
  variants,
  setVariants,
}: Props) {
  /* ================= INPUT ================= */
  const [label1, setLabel1] = useState<string>("Color");
  const [values1, setValues1] = useState<string>("");

  const [label2, setLabel2] = useState<string>("Size");
  const [values2, setValues2] = useState<string>("");

  const [label3, setLabel3] = useState<string>("Style");
  const [values3, setValues3] = useState<string>("");

  /* =========================================================
     GENERATE VARIANTS
========================================================= */

  const generateVariants = (): void => {
    const v1 = parseInput(values1);
    const v2 = parseInput(values2);
    const v3 = parseInput(values3);

    const result: ProductVariant[] = [];

    const push = (
      a: string,
      b?: string,
      c?: string
    ): void => {
      result.push({
        option1: a,
        option2: b ?? null,
        option3: c ?? null,

        optionLabel1: label1,
        optionLabel2: b ? label2 : null,
        optionLabel3: c ? label3 : null,

        sku: makeSku(a, b),

        price: 0,
        stock: 0,

        saleEnabled: false,
        salePrice: null,
        saleStock: 0,

        isActive: true,
      });
    };

    if (v1.length && v2.length && v3.length) {
      for (const a of v1) {
        for (const b of v2) {
          for (const c of v3) {
            push(a, b, c);
          }
        }
      }
    } else if (v1.length && v2.length) {
      for (const a of v1) {
        for (const b of v2) {
          push(a, b);
        }
      }
    } else if (v1.length) {
      for (const a of v1) {
        push(a);
      }
    }

    setVariants(result);
  };

  /* =========================================================
     UPDATE FIELD (TYPE SAFE)
========================================================= */

  const update = <K extends VariantKey>(
    index: number,
    key: K,
    value: ProductVariant[K]
  ): void => {
    const copy = [...variants];
    const v = { ...copy[index], [key]: value };

    /* SALE RULES */
    if (
      typeof v.saleStock === "number" &&
      typeof v.stock === "number" &&
      v.saleStock > v.stock
    ) {
      v.saleStock = v.stock;
    }

    if (
      typeof v.salePrice === "number" &&
      typeof v.price === "number" &&
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

  const bulkSet = <K extends VariantKey>(
    key: K,
    value: ProductVariant[K]
  ): void => {
    setVariants(
      variants.map((v) => ({
        ...v,
        [key]: value,
      }))
    );
  };

  /* =========================================================
     REMOVE
========================================================= */

  const remove = (index: number): void => {
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
            placeholder="Option 1 label"
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
            placeholder="Option 2 label"
          />

          <input
            value={values2}
            onChange={(e) => setValues2(e.target.value)}
            className="border p-2 rounded"
            placeholder="S, M"
          />

          <input
            value={label3}
            onChange={(e) => setLabel3(e.target.value)}
            className="border p-2 rounded"
            placeholder="Option 3 label"
          />

          <input
            value={values3}
            onChange={(e) => setValues3(e.target.value)}
            className="border p-2 rounded"
            placeholder="Cotton, Silk"
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
        <div className="grid grid-cols-4 gap-2">
          <input
            type="number"
            placeholder="Price"
            className="border p-2 rounded"
            onBlur={(e) =>
              bulkSet("price", Number(e.target.value))
            }
          />

          <input
            type="number"
            placeholder="Stock"
            className="border p-2 rounded"
            onBlur={(e) =>
              bulkSet("stock", Number(e.target.value))
            }
          />

          <input
            type="text"
            placeholder="SKU prefix"
            className="border p-2 rounded"
            onBlur={(e) => {
              const prefix = e.target.value;
              setVariants(
                variants.map((v) => ({
                  ...v,
                  sku: `${prefix}-${v.option1}${
                    v.option2 ? `-${v.option2}` : ""
                  }`,
                }))
              );
            }}
          />

          <button
            type="button"
            className="bg-orange-500 text-white rounded"
            onClick={() => bulkSet("saleEnabled", true)}
          >
            Enable Sale
          </button>
        </div>
      )}

      {/* ================= TABLE ================= */}
      {variants.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead>
              <tr className="bg-gray-100">
                <th>Variant</th>
                <th>SKU</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Sale</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {variants.map((v, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">
                    {v.option1}
                    {v.option2 ? ` - ${v.option2}` : ""}
                    {v.option3 ? ` - ${v.option3}` : ""}
                  </td>

                  <td className="p-2">
                    <input
                      value={v.sku ?? ""}
                      onChange={(e) =>
                        update(i, "sku", e.target.value)
                      }
                      className="border p-1 w-32"
                      placeholder="SKU"
                    />
                  </td>

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

                  <td className="p-2">
                    <label className="flex gap-2 items-center">
                      <input
                        type="checkbox"
                        checked={v.saleEnabled}
                        onChange={(e) =>
                          update(
                            i,
                            "saleEnabled",
                            e.target.checked
                          )
                        }
                      />
                      Sale
                    </label>

                    {v.saleEnabled && (
                      <div className="space-y-1">
                        <input
                          type="number"
                          value={v.salePrice ?? ""}
                          onChange={(e) =>
                            update(
                              i,
                              "salePrice",
                              Number(e.target.value)
                            )
                          }
                          className="border p-1 w-24"
                          placeholder="Sale price"
                        />

                        <input
                          type="number"
                          value={v.saleStock}
                          onChange={(e) =>
                            update(
                              i,
                              "saleStock",
                              Number(e.target.value)
                            )
                          }
                          className="border p-1 w-24"
                          placeholder="Sale stock"
                        />
                      </div>
                    )}
                  </td>

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

"use client";

import { useState } from "react";
import { SellerAddressType, SellerAddress } from "../types";
import { getPiAccessToken } from "@/lib/piAuth";

/* =========================================================
   INPUT TYPE
========================================================= */

type CreateAddressInput = {
  type: SellerAddressType;

  recipient_name: string;
  phone: string;

  country: string;
  province: string;
  district: string;
  ward?: string;

  address_line: string;
  postal_code?: string;

  is_default?: boolean;
};

/* =========================================================
   PROPS
========================================================= */

type Props = {
  onClose: () => void;
  onCreated: (addr: SellerAddress) => void;
};

/* =========================================================
   COMPONENT
========================================================= */

export default function AddressForm({
  onClose,
  onCreated,
}: Props) {
  const [form, setForm] = useState<CreateAddressInput>({
    type: "return",

    recipient_name: "",
    phone: "",

    country: "VN",
    province: "",
    district: "",
    ward: "",

    address_line: "",
    postal_code: "",

    is_default: false,
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const token = await getPiAccessToken();

      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch("/api/seller/addresses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        throw new Error("Failed to create address");
      }

      const data: SellerAddress = await res.json();

      onCreated(data);
      onClose();
    } catch (err) {
      console.error("CREATE ADDRESS ERROR", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-[var(--card-bg)] p-4 space-y-3">

        <h2 className="text-lg font-bold">Add Address</h2>

        {/* TYPE */}
        <select
          value={form.type}
          onChange={(e) =>
            setForm({
              ...form,
              type: e.target.value as SellerAddressType,
            })
          }
          className="w-full border rounded-xl p-2"
        >
          <option value="return">Return</option>
          <option value="warehouse">Warehouse</option>
          <option value="pickup">Pickup</option>
          <option value="support">Support</option>
        </select>

        {/* NAME */}
        <input
          placeholder="Recipient name"
          value={form.recipient_name}
          onChange={(e) =>
            setForm({
              ...form,
              recipient_name: e.target.value,
            })
          }
          className="w-full border rounded-xl p-2"
        />

        {/* PHONE */}
        <input
          placeholder="Phone"
          value={form.phone}
          onChange={(e) =>
            setForm({
              ...form,
              phone: e.target.value,
            })
          }
          className="w-full border rounded-xl p-2"
        />

        {/* ADDRESS */}
        <input
          placeholder="Address line"
          value={form.address_line}
          onChange={(e) =>
            setForm({
              ...form,
              address_line: e.target.value,
            })
          }
          className="w-full border rounded-xl p-2"
        />

        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Province"
            value={form.province}
            onChange={(e) =>
              setForm({
                ...form,
                province: e.target.value,
              })
            }
            className="border rounded-xl p-2"
          />

          <input
            placeholder="District"
            value={form.district}
            onChange={(e) =>
              setForm({
                ...form,
                district: e.target.value,
              })
            }
            className="border rounded-xl p-2"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2 rounded-xl bg-orange-500 text-white"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

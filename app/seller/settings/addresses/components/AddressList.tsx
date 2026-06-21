"use client";

import AddressCard from "./AddressCard";
import { SellerAddress } from "../types";

type Props = {
  addresses: SellerAddress[];
  onUpdate: (data: SellerAddress[]) => void;
};

export default function AddressList({
  addresses,
  onUpdate,
}: Props) {

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch("/api/seller-addresses/set-default", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) return;

      const updated = await res.json();
      onUpdate(updated);
    } catch (err) {
      console.error("SET DEFAULT ERROR", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/seller-addresses/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) return;

      onUpdate(addresses.filter((a) => a.id !== id));
    } catch (err) {
      console.error("DELETE ERROR", err);
    }
  };

  if (!addresses.length) {
    return (
      <div className="text-center text-sm text-[var(--text-muted)] py-10">
        No addresses yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {addresses.map((item) => (
        <AddressCard
          key={item.id}
          item={item}
          onSetDefault={handleSetDefault}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
}

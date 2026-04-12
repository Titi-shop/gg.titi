"use client";

import { formatPi } from "@/lib/pi";
import { useCheckout } from "./checkout.logic";
import { getCountryDisplay } from "./checkout.helpers";

export default function CheckoutSheet({ open, onClose, product }: any) {
  const {
    item,
    quantity,
    setQtyDraft,
    maxStock,
    shipping,
    zone,
    setZone,
    handlePay,
    processing,
    preview,
  } = useCheckout(product, open, onClose);

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl h-[65vh] flex flex-col">
        
        <div className="flex-1 overflow-y-auto px-4 py-3 pb-24">

          {/* ADDRESS */}
          <div className="border p-3 mb-4">
            {shipping ? (
              <>
                <p>{shipping.name}</p>
                <p>{shipping.phone}</p>
                <p>{shipping.address_line}</p>
                <p>
                  {shipping.province} – {getCountryDisplay(shipping.country)}
                </p>
              </>
            ) : (
              <p>➕ Add address</p>
            )}
          </div>

          {/* PRODUCT */}
          <div className="flex gap-3">
            <img src={item.thumbnail} className="w-16 h-16" />
            <div className="flex-1">
              <p>{item.name}</p>

              <input
                value={quantity}
                onChange={(e) => setQtyDraft(e.target.value)}
              />
            </div>

            <p>{formatPi(preview?.total ?? item.finalPrice)} π</p>
          </div>
        </div>

        {/* ACTION */}
        <div className="p-4 border-t">
          <button
            onClick={handlePay}
            className="w-full bg-orange-600 text-white py-3 rounded"
          >
            Pay now
          </button>
        </div>
      </div>
    </div>
  );
}

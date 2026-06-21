"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
ArrowLeft,
MapPin,
Package,
Truck,
ShieldCheck,
} from "lucide-react";

import { getPiAccessToken } from "@/lib/piAuth";

type SellerReturnAddress = {
recipient_name: string | null;
phone: string | null;

country: string;
region?: string | null;
district?: string | null;
ward?: string | null;

address_line: string;
postal_code?: string | null;
};

type ReturnShippingData = {
id: string;
order_id: string;
status: string;

product_name?: string;
thumbnail?: string;

seller_address: SellerReturnAddress;
};

export default function ReturnShippingPage() {
const params = useParams();
const router = useRouter();

const returnId = params.id as string;

const [loading, setLoading] = useState(true);
const [submitting, setSubmitting] =
useState(false);

const [carrier, setCarrier] =
useState("");

const [trackingCode, setTrackingCode] =
useState("");

const [data, setData] =
useState<ReturnShippingData | null>(
null
);

useEffect(() => {
const load = async () => {
try {
const token =
await getPiAccessToken();

    const res = await fetch(
  `/api/returns/${returnId}`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
);

    if (!res.ok) {
      throw new Error(
        "LOAD_RETURN_FAILED"
      );
    }

    const json =
      await res.json();

    setData(json);
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
};

load();

}, [returnId]);

const handleSubmit = async () => {
if (!carrier.trim()) {
alert(
"Please select carrier"
);
return;
}

if (!trackingCode.trim()) {
  alert(
    "Please enter tracking code"
  );
  return;
}

try {
  setSubmitting(true);

  const token =
    await getPiAccessToken();

  const res = await fetch(
  `/api/returns/${returnId}/ship`,
  {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      tracking_code: trackingCode,
      shipping_provider: carrier,
    }),
  }
);

  if (!res.ok) {
    throw new Error(
      "SHIP_RETURN_FAILED"
    );
  }

  router.push(
    `/customer/returns/${returnId}`
  );
} catch (err) {
  console.error(err);

  alert(
    "Failed to confirm shipment"
  );
} finally {
  setSubmitting(false);
}

};

if (loading) {
return (
<main className="p-4">
Loading...
</main>
);
}

if (!data) {
return (
<main className="p-4">
Return not found
</main>
);
}

return (
<main
className="
min-h-screen
bg-[var(--background)]
pb-32
"
>
{/* HEADER */}

  <div
    className="
      sticky top-0 z-20
      border-b
      bg-[var(--background)]
    "
  >
    <div
      className="
        mx-auto flex
        max-w-2xl
        items-center gap-3
        p-4
      "
    >
      <button
        onClick={() =>
          router.back()
        }
      >
        <ArrowLeft size={20} />
      </button>

      <h1
        className="
          text-lg font-bold
        "
      >
        Return Shipment
      </h1>
    </div>
  </div>

  <div
    className="
      mx-auto
      max-w-2xl
      space-y-4
      p-4
    "
  >
    {/* PRODUCT */}

    <div
      className="
        rounded-3xl
        border
        bg-[var(--card-bg)]
        p-4
      "
    >
      <div
        className="
          flex items-center gap-3
        "
      >
        <Package size={18} />

        <div>
          <p
            className="
              text-sm
              text-[var(--text-muted)]
            "
          >
            Return ID
          </p>

          <p className="font-semibold">
            {data.id}
          </p>
        </div>
      </div>
    </div>

    {/* RETURN ADDRESS */}

    <div
      className="
        rounded-3xl
        border
        bg-[var(--card-bg)]
        p-4
      "
    >
      <div
        className="
          mb-4 flex
          items-center gap-2
        "
      >
        <MapPin size={18} />

        <h2 className="font-semibold">
          Return Address
        </h2>
      </div>

      <div
        className="
          space-y-1
          text-sm
        "
      >
        <p className="font-medium">
          {
            data.seller_address
              .recipient_name
          }
        </p>

        <p>
          {
            data.seller_address
              .phone
          }
        </p>

        <p>
          {
            data.seller_address
              .address_line
          }
        </p>

        <p>
          {[
            data.seller_address
              .ward,
            data.seller_address
              .district,
            data.seller_address
              .region,
          ]
            .filter(Boolean)
            .join(", ")}
        </p>

        <p>
          {
            data.seller_address
              .country
          }
        </p>
      </div>
    </div>

    {/* INSTRUCTIONS */}

    <div
      className="
        rounded-3xl
        border
        bg-[var(--card-bg)]
        p-4
      "
    >
      <div
        className="
          mb-3 flex
          items-center gap-2
        "
      >
        <ShieldCheck size={18} />
        <h2 className="font-semibold">
          Shipping Instructions
        </h2>
      </div>

      <ul
        className="
          list-disc
          space-y-2
          pl-5
          text-sm
        "
      >
        <li>
          Pack the product
          securely.
        </li>

        <li>
          Include all
          accessories if
          required.
        </li>

        <li>
          Keep your shipping
          receipt.
        </li>

        <li>
          Enter tracking
          information below
          after shipment.
        </li>
      </ul>
    </div>

    {/* SHIPPING FORM */}

    <div
      className="
        rounded-3xl
        border
        bg-[var(--card-bg)]
        p-4
        space-y-4
      "
    >
      <div
        className="
          flex items-center gap-2
        "
      >
        <Truck size={18} />

        <h2 className="font-semibold">
          Shipping Details
        </h2>
      </div>

      <select
        value={carrier}
        onChange={(e) =>
          setCarrier(
            e.target.value
          )
        }
        className="
          w-full rounded-xl
          border p-3
        "
      >
        <option value="">
          Select Carrier
        </option>

        <option>
          DHL
        </option>

        <option>
          FedEx
        </option>

        <option>
          UPS
        </option>

        <option>
          J&T Express
        </option>

        <option>
          Viettel Post
        </option>

        <option>
          VNPost
        </option>

        <option>
          Other
        </option>
      </select>

      <input
        value={trackingCode}
        onChange={(e) =>
          setTrackingCode(
            e.target.value
          )
        }
        placeholder="Tracking Number"
        className="
          w-full rounded-xl
          border p-3
        "
      />
    </div>
  </div>

  {/* STICKY ACTION */}

  <div
    className="
      fixed bottom-0 left-0 right-0
      border-t
      bg-[var(--background)]
      p-4
    "
  >
    <div
      className="
        mx-auto
        max-w-2xl
      "
    >
      <button
        onClick={
          handleSubmit
        }
        disabled={
          submitting
        }
        className="
          w-full rounded-2xl
          bg-orange-500
          py-4
          font-semibold
          text-white
        "
      >
        {submitting
          ? "Submitting..."
          : "I've Shipped the Item"}
      </button>
    </div>
  </div>
</main>

);
}

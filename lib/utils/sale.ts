export function isSaleActive(
  saleEnabled?: boolean,
  salePrice?: number | null,
  price?: number | null,
  saleStart?: string | Date | null,
  saleEnd?: string | Date | null
): boolean {
  console.log(
    "🧪 [SALE_CHECK]",
    {
      saleEnabled,
      salePrice,
      price,
      saleStart,
      saleEnd,
    }
  );

  if (!saleEnabled) {
    console.log(
      "🧪 [SALE_CHECK] DISABLED"
    );

    return false;
  }

  if (
    salePrice == null ||
    price == null ||
    salePrice <= 0 ||
    salePrice >= price
  ) {
    console.log(
      "🧪 [SALE_CHECK] INVALID_PRICE"
    );

    return false;
  }

  /* =========================
     MUST HAVE SALE WINDOW
  ========================= */

  if (!saleStart || !saleEnd) {
    console.log(
      "🧪 [SALE_CHECK] MISSING_WINDOW"
    );

    return false;
  }

  const start =
  new Date(saleStart).getTime();

const end =
  new Date(saleEnd).getTime();

if (
  Number.isNaN(start) ||
  Number.isNaN(end)
) {
  console.log(
    "🧪 [SALE_CHECK] INVALID_WINDOW"
  );

  return false;
}

if (start >= end) {
  console.log(
    "🧪 [SALE_CHECK] INVALID_RANGE"
  );

  return false;
}

const now =
  Date.now();

  console.log(
    "🧪 [SALE_WINDOW]",
    {
      start,
      end,
      now,
      started:
        now >= start,
      expired:
        now > end,
    }
  );

  if (now < start) {
    console.log(
      "🧪 [SALE_CHECK] NOT_STARTED"
    );

    return false;
  }

  if (now > end) {
    console.log(
      "🧪 [SALE_CHECK] EXPIRED"
    );

    return false;
  }

  console.log(
    "🧪 [SALE_CHECK] ACTIVE"
  );

  return true;
}

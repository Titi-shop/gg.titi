import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

import {
  getAddressesByUser,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
} from "@/lib/db/addresses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================
   TYPES
========================= */

interface AddressPayload {
  id?: string;
  full_name: string;
  phone: string;
  country: string;

  region: string;
  district?: string;
  ward?: string;

  address_line: string;
  postal_code?: string | null;
  label?: "home" | "office" | "other";
}

/* =========================
   VALIDATE
========================= */

function parseBody(body: unknown): AddressPayload | null {
  if (!body || typeof body !== "object") return null;

  const b = body as Record<string, unknown>;

  if (
    typeof b.full_name !== "string" ||
    typeof b.phone !== "string" ||
    typeof b.country !== "string" ||
    typeof b.region !== "string" ||
    typeof b.address_line !== "string"
  ) {
    return null;
  }

  return {
    id: typeof b.id === "string" ? b.id : undefined,
    full_name: b.full_name.trim(),
    phone: b.phone.trim(),
    country: b.country.trim(),

    region: b.region.trim(),
    district:
      typeof b.district === "string" ? b.district.trim() : "",
    ward:
      typeof b.ward === "string" ? b.ward.trim() : "",

    address_line: b.address_line.trim(),

    postal_code:
      typeof b.postal_code === "string"
        ? b.postal_code.trim()
        : null,

    label:
      b.label === "office" || b.label === "other"
        ? b.label
        : "home",
  };
}

/* =========================
   GET
========================= */
export async function GET() {
  try {
    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    const items = await getAddressesByUser(userId);

    return NextResponse.json({
      success: true,
      items,
    });
  } catch (err) {
    console.error("[ADDRESS][GET]", err);

    return NextResponse.json(
      { error: "FETCH_FAILED" },
      { status: 500 }
    );
  }
}

/* =========================
   POST (CREATE)
========================= */
export async function POST(req: Request) {
  try {
    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    let raw: unknown;

    try {
      raw = await req.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON" },
        { status: 400 }
      );
    }

    const payload = parseBody(raw);

    if (!payload) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD" },
        { status: 400 }
      );
    }

    const address = await createAddress(userId, payload);

    return NextResponse.json({
      success: true,
      address,
    });
  } catch (err) {
    console.error("[ADDRESS][CREATE]", err);

    return NextResponse.json(
      { error: "CREATE_FAILED" },
      { status: 500 }
    );
  }
}

/* =========================
   PATCH (UPDATE)
========================= */
export async function PATCH(req: Request) {
  try {
    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    let raw: unknown;

    try {
      raw = await req.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON" },
        { status: 400 }
      );
    }

    const payload = parseBody(raw);

    if (!payload || !payload.id) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD" },
        { status: 400 }
      );
    }

    const address = await updateAddress(
      userId,
      payload.id,
      payload
    );

    return NextResponse.json({
      success: true,
      address,
    });
  } catch (err) {
    console.error("[ADDRESS][UPDATE]", err);

    return NextResponse.json(
      { error: "UPDATE_FAILED" },
      { status: 500 }
    );
  }
}

/* =========================
   PUT (SET DEFAULT)
========================= */
export async function PUT(req: Request) {
  try {
    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON" },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || !("id" in body)) {
      return NextResponse.json(
        { error: "INVALID_ID" },
        { status: 400 }
      );
    }

    const { id } = body as { id: string };

    if (typeof id !== "string" || !id) {
      return NextResponse.json(
        { error: "INVALID_ID" },
        { status: 400 }
      );
    }

    await setDefaultAddress(userId, id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[ADDRESS][SET_DEFAULT]", err);

    return NextResponse.json(
      { error: "SET_DEFAULT_FAILED" },
      { status: 500 }
    );
  }
}

/* =========================
   DELETE
========================= */
export async function DELETE(req: Request) {
  try {
    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "INVALID_ID" },
        { status: 400 }
      );
    }

    await deleteAddress(userId, id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[ADDRESS][DELETE]", err);

    return NextResponse.json(
      { error: "DELETE_FAILED" },
      { status: 500 }
    );
  }
}

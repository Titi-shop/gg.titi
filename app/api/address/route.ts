import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { getUserIdByPiUid } from "@/lib/db/users";

import {
  getAddressesByUser,
  createAddress,
  setDefaultAddress,
  deleteAddress,
} from "@/lib/db/addresses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================
   GET
========================= */
export async function GET(req: Request) {
  const user = await getUserFromBearer(req);

  if (!user?.pi_uid) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const userId = await getUserIdByPiUid(user.pi_uid);

if (!userId) {
  return NextResponse.json(
    { error: "USER_NOT_FOUND" },
    { status: 404 }
  );
}

  const items = await getAddressesByUser(userId);

  return NextResponse.json({
    success: true,
    items,
  });
}

/* =========================
   POST
========================= */
export async function POST(req: Request) {
  const user = await getUserFromBearer(req);

  if (!user?.pi_uid) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const userId = await getUserIdByPiUid(user.pi_uid);

if (!userId) {
  return NextResponse.json(
    { error: "USER_NOT_FOUND" },
    { status: 404 }
  );
}


  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const {
    full_name,
    phone,
    country,
    province,
    district,
    ward,
    address_line,
    postal_code,
    label,
  } = body as Record<string, unknown>;

  if (
    typeof full_name !== "string" ||
    typeof phone !== "string" ||
    typeof country !== "string" ||
    typeof province !== "string" ||
    typeof address_line !== "string"
  ) {
    return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const address = await createAddress(userId, {
    full_name: full_name.trim(),
    phone: phone.trim(),
    country: country.trim(),
    province: province.trim(),
    district: typeof district === "string" ? district.trim() : null,
    ward: typeof ward === "string" ? ward.trim() : null,
    address_line: address_line.trim(),
    postal_code: typeof postal_code === "string" ? postal_code.trim() : null,
    label:
      label === "office" || label === "other"
        ? label
        : "home",
  });

  return NextResponse.json({
    success: true,
    address,
  });
}

/* =========================
   PUT (SET DEFAULT)
========================= */
export async function PUT(req: Request) {
  const user = await getUserFromBearer(req);

  if (!user?.pi_uid) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const userId = await getUserIdByPiUid(user.pi_uid);

if (!userId) {
  return NextResponse.json(
    { error: "USER_NOT_FOUND" },
    { status: 404 }
  );
}


  const body = await req.json();

  if (!body || typeof body !== "object" || !("id" in body)) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  const { id } = body as { id: string };

  await setDefaultAddress(userId, id);

  return NextResponse.json({ success: true });
}

/* =========================
   DELETE
========================= */
export async function DELETE(req: Request) {
  const user = await getUserFromBearer(req);

  if (!user?.pi_uid) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const userId = await getUserIdByPiUid(user.pi_uid);

if (!userId) {
  return NextResponse.json(
    { error: "USER_NOT_FOUND" },
    { status: 404 }
  );
}



  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  await deleteAddress(userId, id);

  return NextResponse.json({ success: true });
}

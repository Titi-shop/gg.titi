import { NextResponse } from "next/server";
import { getUserFromBearer } from "./getUserFromBearer";
import { getUserRoleByUserId } from "@/lib/db/users";

type Role = "admin" | "seller" | "customer";

type GuardSuccess = {
  ok: true;
  userId: string;
  role: Role;
};

type GuardFail = {
  ok: false;
  response: NextResponse;
};

type GuardResult = GuardSuccess | GuardFail;

// 🔥 CACHE ROLE (userId → role)
const roleCache = new Map<string, { role: Role; exp: number }>();

async function resolveRole(userId: string): Promise<Role | null> {
  const cached = roleCache.get(userId);
  if (cached && cached.exp > Date.now()) {
    return cached.role;
  }

  const role = await getUserRoleByUserId(userId);
  if (!role) return null;

  roleCache.set(userId, {
    role,
    exp: Date.now() + 60_000, // 60s
  });

  return role;
}

/* ================= BASE AUTH ================= */
export async function requireAuth(): Promise<GuardResult> {
  const auth = await getUserFromBearer();

  if (!auth) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      ),
    };
  }

  const role = await resolveRole(auth.userId);

  if (!role) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "ROLE_NOT_FOUND" },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    userId: auth.userId,
    role,
  };
}

/* ================= SELLER ================= */
export async function requireSeller(): Promise<GuardResult> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;

  if (auth.role !== "seller" && auth.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      ),
    };
  }

  return auth;
}

/* ================= CUSTOMER ================= */
export async function requireCustomer(): Promise<GuardResult> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;

  if (auth.role !== "customer") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      ),
    };
  }

  return auth;
}

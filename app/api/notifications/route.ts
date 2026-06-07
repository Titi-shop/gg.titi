// app/api/notifications/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

export async function GET() {
  try {
    // 🔐 AUTH
    const user = await getUserFromBearer();
    if (!user) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // 📥 LOAD NOTIFICATIONS
    const { rows } = await query<NotificationRow>(
      `
      SELECT id, title, message, created_at
      FROM notifications
      WHERE uid = $1
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [user.pi_uid]
    );

    return NextResponse.json(
      rows.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        date: n.created_at,
      }))
    );
  } catch (err) {
    console.error("❌ NOTIFICATIONS ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

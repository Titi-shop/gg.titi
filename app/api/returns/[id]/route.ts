import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/guard";

import {
  getReturnByIdForBuyer,
  cancelReturnByBuyer,
} from "@/lib/db/returns";

export const runtime = "nodejs";

/* =====================================================
   HELPERS
===================================================== */

function isValidUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function errorJson(
  code: string,
  status = 400
) {
  return NextResponse.json(
    { error: code },
    { status }
  );
}

function mapError(
  error: unknown
) {
  const message =
    error instanceof Error
      ? error.message
      : "INTERNAL_ERROR";

  switch (message) {
    case "RETURN_NOT_FOUND":
      return errorJson(
        message,
        404
      );

    case "RETURN_NOT_CANCELABLE":
      return errorJson(
        message,
        400
      );

    case "INVALID_INPUT":
      return errorJson(
        message,
        400
      );

    default:
      return errorJson(
        "INTERNAL_ERROR",
        500
      );
  }
}

/* =====================================================
   GET /api/returns/[id]
===================================================== */

export async function GET(
  _req: NextRequest,
  context: {
    params: {
      id: string;
    };
  }
) {
  try {
    const auth =
      await requireAuth();

    if (!auth.ok) {
      return auth.response;
    }

    const userId =
      auth.userId;

    const id =
      context.params.id?.trim() ??
      "";

    if (!isValidUuid(id)) {
      return errorJson(
        "INVALID_UUID",
        400
      );
    }

    const item =
      await getReturnByIdForBuyer(
        id,
        userId
      );

    if (!item) {
      return errorJson(
        "RETURN_NOT_FOUND",
        404
      );
    }

    return NextResponse.json(
      item
    );
  } catch (error) {
    return mapError(error);
  }
}

/* =====================================================
   PATCH /api/returns/[id]
   buyer cancel request
===================================================== */

export async function PATCH(
  req: NextRequest,
  context: {
    params: {
      id: string;
    };
  }
) {
  try {
    const auth =
      await requireAuth();

    if (!auth.ok) {
      return auth.response;
    }

    const userId =
      auth.userId;

    const id =
      context.params.id?.trim() ??
      "";

    if (!isValidUuid(id)) {
      return errorJson(
        "INVALID_UUID",
        400
      );
    }

    const body =
      (await req.json()) as {
        action?: string;
      };

    const action =
      body.action?.trim() ?? "";

    if (
      action !== "cancel"
    ) {
      return errorJson(
        "INVALID_ACTION",
        400
      );
    }

    await cancelReturnByBuyer(
      id,
      userId
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    return mapError(error);
  }
}

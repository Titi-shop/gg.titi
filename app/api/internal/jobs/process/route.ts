import { NextResponse } from "next/server";

import {
  processEscrowReleaseJob,
} from "@/lib/services/escrow.release.job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {

  try {

    const result =
      await processEscrowReleaseJob();

    return NextResponse.json(result);

  } catch (error) {

    console.error(
      "[JOBS][FATAL]",
      error
    );

    return NextResponse.json(
      {
        success: false,
      },
      {
        status: 500,
      }
    );
  }
}

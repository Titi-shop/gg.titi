// =====================================================
// lib/db/settlement/settlement.utils.ts
// =====================================================
import {
  createHash,
} from "crypto";
/* =====================================================
   HASH
===================================================== */
export function makeEventHash(
  payload: unknown
): string {
  return createHash("sha256")
    .update(
      JSON.stringify(payload)
    )
    .digest("hex");
}

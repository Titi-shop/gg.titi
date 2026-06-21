// =====================================================
// lib/services/escrow.release.job.ts
// =====================================================

import {
  withTransaction,
} from "@/lib/db";

import {
  findReleasableEscrows,
  releaseEscrowFlow,
} from "@/lib/db/settlement";

export async function processEscrowReleaseJob() {

  console.log(
    "[ESCROW_JOB] START"
  );

  try {

    return await withTransaction(
      async (client) => {

        console.log(
          "[ESCROW_JOB] TX_BEGIN"
        );

        /* =============================================
           FIND ESCROWS
        ============================================= */

        const escrows =
          await findReleasableEscrows(
            client
          );

        console.log(
          "[ESCROW_JOB] ESCROWS_FOUND",
          {
            total:
              escrows.length,
          }
        );

        if (
          !escrows.length
        ) {

          console.log(
            "[ESCROW_JOB] NOTHING_TO_PROCESS"
          );

          return {
            success: true,
            processed: 0,
          };
        }

        /* =============================================
           PROCESS LOOP
        ============================================= */

        for (const escrow of escrows) {

          console.log(
            "[ESCROW_JOB] PROCESS_ESCROW_START",
            {
              escrowId:
                escrow.id,

              orderId:
                escrow.order_id,

              sellerId:
                escrow.seller_id,

              amount:
                escrow.amount,

              releaseAfter:
                escrow.release_after,
            }
          );

          try {

            await releaseEscrowFlow({
              client,
              escrow,
            });

            console.log(
              "[ESCROW_JOB] PROCESS_ESCROW_SUCCESS",
              {
                escrowId:
                  escrow.id,

                orderId:
                  escrow.order_id,
              }
            );

          } catch (error) {

            console.error(
              "[ESCROW_JOB] PROCESS_ESCROW_FAILED",
              {
                escrowId:
                  escrow.id,

                orderId:
                  escrow.order_id,

                error,
              }
            );

            throw error;
          }
        }

        /* =============================================
           DONE
        ============================================= */

        console.log(
          "[ESCROW_JOB] COMPLETE",
          {
            processed:
              escrows.length,
          }
        );

        return {
          success: true,
          processed:
            escrows.length,
        };
      }
    );

  } catch (error) {

    console.error(
      "[ESCROW_JOB] FATAL",
      error
    );

    throw error;
  }
}

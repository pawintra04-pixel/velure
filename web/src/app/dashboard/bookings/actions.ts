"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { releaseClassSeat } from "@/lib/classes";

// Only these target statuses are reachable from the dashboard, and only
// from these source statuses — never trust a status string from the client
// beyond picking among a fixed, validated set of transitions.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  CANCELLED: ["TEMPORARY_HOLD", "PAYMENT_PENDING", "CONFIRMED"],
  COMPLETED: ["CONFIRMED"],
  NO_SHOW: ["CONFIRMED"],
};

export async function updateBookingStatus(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const bookingId = String(formData.get("bookingId") ?? "");
  const nextStatus = String(formData.get("nextStatus") ?? "");

  const allowedFrom = ALLOWED_TRANSITIONS[nextStatus];
  if (!allowedFrom) {
    throw new Error("Invalid status transition.");
  }

  await withBusinessContext(owner.businessId, async (c) => {
    const { rows: [updated] } = await c.query(
      `UPDATE bookings SET status = $1
       WHERE id = $2 AND status = ANY($3::booking_status[])
       RETURNING class_session_id`,
      [nextStatus, bookingId, allowedFrom]
    );
    // Only an actual cancellation frees the seat — a no-show still took
    // the spot, they just didn't turn up for it.
    if (updated?.class_session_id && nextStatus === "CANCELLED") {
      await releaseClassSeat(c, updated.class_session_id);
    }
  });

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
}

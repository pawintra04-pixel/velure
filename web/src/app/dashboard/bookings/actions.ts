"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { releaseClassSeat } from "@/lib/classes";
import { isStaffFreeForRange } from "@/lib/staff-availability";

export type ManualBookingResult = { ok: true } | { ok: false; error: string };

/**
 * Staff take bookings by phone/LINE/walk-in no matter what online flow
 * exists — this lets that go straight into the same availability engine
 * instead of living outside it (which is the only way Velure can actually
 * keep its double-booking guarantee: it only holds if every path a
 * booking can enter through respects it). Skips the online hold->pay
 * flow entirely and goes straight to CONFIRMED, since a staff member
 * creating this is presumed to be handling payment themselves in person.
 */
export async function createManualBooking(
  _prev: ManualBookingResult | null,
  formData: FormData
): Promise<ManualBookingResult> {
  const owner = await requireOwner();

  const serviceId = String(formData.get("serviceId") ?? "");
  const staffId = String(formData.get("staffId") ?? "");
  const dateISO = String(formData.get("date") ?? "");
  const timeHHMM = String(formData.get("time") ?? "");
  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const customerEmail = String(formData.get("customerEmail") ?? "").trim();
  const noCharge = formData.get("noCharge") === "on";

  if (!serviceId || !staffId || !dateISO || !timeHHMM || !customerName || !customerPhone) {
    return { ok: false, error: "Service, staff, date/time, customer name and phone are all required." };
  }

  try {
    await withBusinessContext(owner.businessId, async (c) => {
      const { rows: [service] } = await c.query<{
        duration_minutes: number;
        buffer_minutes: number;
        price_amount: number;
        payment_mode: string;
        deposit_amount: number | null;
      }>(
        `SELECT duration_minutes, buffer_minutes, price_amount, payment_mode, deposit_amount
         FROM services WHERE id = $1`,
        [serviceId]
      );
      if (!service) throw new Error("service_not_found");

      const startTime = new Date(`${dateISO}T${timeHHMM}:00+07:00`);
      const endTime = new Date(
        startTime.getTime() + (service.duration_minutes + service.buffer_minutes) * 60_000
      );

      if (!(await isStaffFreeForRange(c, staffId, startTime.toISOString(), endTime.toISOString()))) {
        throw new Error("slot_taken");
      }

      const amount = noCharge
        ? 0
        : service.payment_mode === "free"
          ? 0
          : service.payment_mode === "deposit"
            ? (service.deposit_amount ?? 0)
            : service.price_amount;

      const { rows: [customer] } = await c.query(
        `INSERT INTO customers (business_id, name, phone, email)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (business_id, phone) WHERE phone IS NOT NULL
         DO UPDATE SET name = EXCLUDED.name, email = COALESCE(EXCLUDED.email, customers.email)
         RETURNING id`,
        [owner.businessId, customerName, customerPhone, customerEmail || null]
      );

      await c.query(
        `INSERT INTO bookings
           (business_id, service_id, staff_id, customer_id, start_time, end_time, status, amount, created_by_staff)
         VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED', $7, true)`,
        [
          owner.businessId,
          serviceId,
          staffId,
          customer.id,
          startTime.toISOString(),
          endTime.toISOString(),
          amount,
        ]
      );
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23P01" || (err as Error).message === "slot_taken") {
      return { ok: false, error: "That staff member already has something scheduled at this time." };
    }
    console.error("createManualBooking failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
  return { ok: true };
}

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

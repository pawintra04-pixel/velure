"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createClassSession(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();

  const serviceId = String(formData.get("serviceId") ?? "");
  const staffId = String(formData.get("staffId") ?? "");
  const dateISO = String(formData.get("date") ?? "");
  const timeHHMM = String(formData.get("time") ?? "");

  if (!serviceId || !staffId || !dateISO || !timeHHMM) {
    return { ok: false, error: "All fields are required." };
  }

  try {
    await withBusinessContext(owner.businessId, async (c) => {
      const { rows: [service] } = await c.query<{ duration_minutes: number; capacity: number | null }>(
        `SELECT duration_minutes, capacity FROM services WHERE id = $1`,
        [serviceId]
      );
      if (!service) throw new Error("service_not_found");
      if (!service.capacity || service.capacity < 2) {
        throw new Error("not_a_class");
      }

      const startTime = new Date(`${dateISO}T${timeHHMM}:00+07:00`);
      const endTime = new Date(startTime.getTime() + service.duration_minutes * 60_000);

      await c.query(
        `INSERT INTO class_sessions (business_id, service_id, staff_id, start_time, end_time, capacity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [owner.businessId, serviceId, staffId, startTime.toISOString(), endTime.toISOString(), service.capacity]
      );
    });
  } catch (err) {
    if ((err as Error).message === "not_a_class") {
      return { ok: false, error: "That service isn't set up as a class (needs a capacity of 2 or more)." };
    }
    // The staff-overlap exclusion constraint — this staff member already
    // has a session or booking at this time.
    if ((err as { code?: string }).code === "23P01") {
      return { ok: false, error: "That staff member already has something scheduled at this time." };
    }
    console.error("createClassSession failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/classes");
  return { ok: true };
}

export async function deleteClassSession(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const sessionId = String(formData.get("sessionId") ?? "");

  await withBusinessContext(owner.businessId, async (c) => {
    const { rows: [session] } = await c.query<{ seats_booked: number }>(
      `SELECT seats_booked FROM class_sessions WHERE id = $1`,
      [sessionId]
    );
    if (session && session.seats_booked > 0) {
      throw new Error(
        "Can't remove a session with existing bookings. Cancel each attendee's booking first."
      );
    }
    await c.query(`DELETE FROM class_sessions WHERE id = $1`, [sessionId]);
  });

  revalidatePath("/dashboard/classes");
}

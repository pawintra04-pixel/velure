"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { isStaffFreeForRange, isSlotConflictError } from "@/lib/staff-availability";
import type { ConfirmActionResult } from "@/components/ConfirmSubmitButton";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function addStaff(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const owner = await requireOwner();

  const name = String(formData.get("name") ?? "").trim();
  const serviceIds = formData.getAll("serviceIds").map(String);

  if (!name) {
    return { ok: false, error: "Name is required." };
  }

  await withBusinessContext(owner.businessId, async (c) => {
    const { rows: [staff] } = await c.query(
      `INSERT INTO staff (business_id, name) VALUES ($1, $2) RETURNING id`,
      [owner.businessId, name]
    );
    for (const serviceId of serviceIds) {
      await c.query(
        `INSERT INTO staff_services (business_id, staff_id, service_id) VALUES ($1, $2, $3)`,
        [owner.businessId, staff.id, serviceId]
      );
    }
    // Default a new staff member's weekly schedule to whatever the
    // business's own hours already are (rather than re-hardcoding
    // 09:00-19:00) — an owner who already narrowed their shop's hours in
    // Settings shouldn't have every new hire silently open outside them.
    await c.query(
      `INSERT INTO staff_hours (business_id, staff_id, day_of_week, is_off, start_time, end_time)
       SELECT business_id, $1, day_of_week, is_closed, open_time, close_time
       FROM business_hours WHERE business_id = $2`,
      [staff.id, owner.businessId]
    );
  });

  revalidatePath("/dashboard/staff");
  return { ok: true };
}

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export async function updateStaffHours(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();
  const staffId = String(formData.get("staffId") ?? "");
  if (!staffId) return { ok: false, error: "Missing staff member." };

  const rows = DAYS.map((dow) => {
    const isOff = formData.get(`off_${dow}`) === "on";
    const start = String(formData.get(`start_${dow}`) ?? "");
    const end = String(formData.get(`end_${dow}`) ?? "");
    const breakStart = String(formData.get(`breakStart_${dow}`) ?? "");
    const breakEnd = String(formData.get(`breakEnd_${dow}`) ?? "");
    return { dow, isOff, start, end, breakStart, breakEnd };
  });

  for (const row of rows) {
    if (row.isOff) continue;
    if (!row.start || !row.end || row.start >= row.end) {
      return { ok: false, error: "Each working day needs an end time after its start time." };
    }
    const hasBreak = row.breakStart || row.breakEnd;
    if (hasBreak) {
      if (!row.breakStart || !row.breakEnd || row.breakStart >= row.breakEnd) {
        return { ok: false, error: "A break needs an end time after its start time." };
      }
      if (row.breakStart < row.start || row.breakEnd > row.end) {
        return { ok: false, error: "A break must fall within that day's working hours." };
      }
    }
  }

  await withBusinessContext(owner.businessId, async (c) => {
    for (const row of rows) {
      const hasBreak = !row.isOff && row.breakStart && row.breakEnd;
      await c.query(
        `UPDATE staff_hours
         SET is_off = $1, start_time = $2, end_time = $3, break_start = $4, break_end = $5
         WHERE staff_id = $6 AND day_of_week = $7`,
        [
          row.isOff,
          row.isOff ? null : row.start,
          row.isOff ? null : row.end,
          hasBreak ? row.breakStart : null,
          hasBreak ? row.breakEnd : null,
          staffId,
          row.dow,
        ]
      );
    }
  });

  revalidatePath("/dashboard/staff");
  return { ok: true };
}

/**
 * A staff member marking themselves unavailable (lunch, a meeting, a
 * walk-in already reserved verbally) without needing a fake booking to
 * hold the time — staff_blocks has its own EXCLUDE constraint against
 * itself, and isStaffFreeForRange checks it against bookings/class
 * sessions too before insert (see lib/staff-availability.ts for what
 * that can and can't guarantee).
 */
export async function createStaffBlock(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();

  const staffId = String(formData.get("staffId") ?? "");
  const dateISO = String(formData.get("date") ?? "");
  const startHHMM = String(formData.get("start") ?? "");
  const endHHMM = String(formData.get("end") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!staffId || !dateISO || !startHHMM || !endHHMM) {
    return { ok: false, error: "Date, start, and end time are required." };
  }
  if (startHHMM >= endHHMM) {
    return { ok: false, error: "End time must be after start time." };
  }

  const startTime = new Date(`${dateISO}T${startHHMM}:00+07:00`);
  const endTime = new Date(`${dateISO}T${endHHMM}:00+07:00`);

  try {
    await withBusinessContext(owner.businessId, async (c) => {
      if (!(await isStaffFreeForRange(c, staffId, startTime.toISOString(), endTime.toISOString()))) {
        throw new Error("slot_taken");
      }
      await c.query(
        `INSERT INTO staff_blocks (business_id, staff_id, start_time, end_time, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [owner.businessId, staffId, startTime.toISOString(), endTime.toISOString(), reason || null]
      );
    });
  } catch (err) {
    if (isSlotConflictError(err) || (err as Error).message === "slot_taken") {
      return { ok: false, error: "That staff member already has something scheduled at this time." };
    }
    console.error("createStaffBlock failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/staff");
  return { ok: true };
}

export async function deleteStaffBlock(
  _prev: ConfirmActionResult | null,
  formData: FormData
): Promise<ConfirmActionResult> {
  const owner = await requireOwner();
  const blockId = String(formData.get("blockId") ?? "");

  await withBusinessContext(owner.businessId, (c) =>
    c.query(`DELETE FROM staff_blocks WHERE id = $1`, [blockId])
  );

  revalidatePath("/dashboard/staff");
  return { ok: true };
}

// A staff member with existing bookings can't be deleted (the FK from
// bookings/class_sessions has no cascade, by design — losing who a past
// booking was with would corrupt history and reports). That's an expected,
// recoverable outcome, not a crash, so it's reported the same way every
// other action in this app reports a known failure — via a typed result —
// rather than a thrown Error, which would otherwise escape to the
// dashboard's error boundary and show a generic "Something went wrong"
// page for what the owner should just see as an inline message.
export async function deleteStaff(
  _prev: ConfirmActionResult | null,
  formData: FormData
): Promise<ConfirmActionResult> {
  const owner = await requireOwner();
  const staffId = String(formData.get("staffId") ?? "");

  try {
    await withBusinessContext(owner.businessId, async (c) => {
      await c.query(`DELETE FROM staff_services WHERE staff_id = $1`, [staffId]);
      await c.query(`DELETE FROM staff WHERE id = $1`, [staffId]);
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23503") {
      return {
        ok: false,
        error:
          "Can't delete a staff member who has any booking history, including past or cancelled bookings — this keeps existing reports accurate.",
      };
    }
    console.error("deleteStaff failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/staff");
  return { ok: true, message: "Team member removed" };
}

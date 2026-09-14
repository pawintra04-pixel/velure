"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";

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

export async function deleteStaff(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const staffId = String(formData.get("staffId") ?? "");

  try {
    await withBusinessContext(owner.businessId, async (c) => {
      await c.query(`DELETE FROM staff_services WHERE staff_id = $1`, [staffId]);
      await c.query(`DELETE FROM staff WHERE id = $1`, [staffId]);
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23503") {
      throw new Error(
        "Can't delete a staff member who has existing bookings. Cancel or reassign those bookings first."
      );
    }
    throw err;
  }

  revalidatePath("/dashboard/staff");
}

"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { isStaffFreeForRange, isSlotConflictError } from "@/lib/staff-availability";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

// "YYYY-MM-DD" + N days, pure string/date-math (no timezone conversion
// needed since this only walks calendar dates, matching addDays in
// lib/bookings-data.ts).
function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayOfWeekISO(dateISO: string): number {
  return new Date(`${dateISO}T00:00:00Z`).getUTCDay();
}

/**
 * Creates one occurrence, in its own transaction — called once per date when
 * scheduling a recurring class, so one date losing a race (staff/room
 * already taken) doesn't abort the whole batch the way sharing a single
 * transaction across every INSERT would (Postgres aborts the entire
 * transaction on the first constraint violation).
 */
async function createOneSession(
  businessId: string,
  params: { serviceId: string; staffId: string; resourceId: string | null; dateISO: string; timeHHMM: string }
): Promise<{ ok: true } | { ok: false; reason: "not_a_class" | "slot_taken" | "error" }> {
  try {
    await withBusinessContext(businessId, async (c) => {
      const { rows: [service] } = await c.query<{ duration_minutes: number; capacity: number | null }>(
        `SELECT duration_minutes, capacity FROM services WHERE id = $1`,
        [params.serviceId]
      );
      if (!service) throw new Error("service_not_found");
      if (!service.capacity || service.capacity < 2) {
        throw new Error("not_a_class");
      }

      const startTime = new Date(`${params.dateISO}T${params.timeHHMM}:00+07:00`);
      const endTime = new Date(startTime.getTime() + service.duration_minutes * 60_000);

      // class_sessions' own EXCLUDE constraint only guards it against
      // *other* class sessions — a single Postgres constraint can't span
      // tables, so an existing 1:1 booking or a block for this staff
      // member wouldn't otherwise be checked at all before this insert.
      if (!(await isStaffFreeForRange(c, params.staffId, startTime.toISOString(), endTime.toISOString()))) {
        throw new Error("slot_taken");
      }

      await c.query(
        `INSERT INTO class_sessions (business_id, service_id, staff_id, start_time, end_time, capacity, resource_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          businessId,
          params.serviceId,
          params.staffId,
          startTime.toISOString(),
          endTime.toISOString(),
          service.capacity,
          params.resourceId,
        ]
      );
    });
    return { ok: true };
  } catch (err) {
    if ((err as Error).message === "not_a_class") return { ok: false, reason: "not_a_class" };
    if (isSlotConflictError(err) || (err as Error).message === "slot_taken") {
      return { ok: false, reason: "slot_taken" };
    }
    console.error("createOneSession failed", err);
    return { ok: false, reason: "error" };
  }
}

/**
 * Handles both a single one-off class (no repeatUntil / no weekdays
 * selected — the original behavior) and a recurring one: every checked
 * weekday between startDate and repeatUntil, inclusive. Each occurrence is
 * still a fully independent class_sessions row afterward, editable/
 * cancellable/removable exactly like one created one at a time — there's no
 * separate "template" the owner has to manage, matching how a class
 * session's own attendees are each a normal booking row instead of a
 * parallel system (see 013_class_sessions.sql).
 */
export async function createClassSession(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();

  const serviceId = String(formData.get("serviceId") ?? "");
  const staffId = String(formData.get("staffId") ?? "");
  const startDate = String(formData.get("date") ?? "");
  const timeHHMM = String(formData.get("time") ?? "");
  const resourceId = String(formData.get("resourceId") ?? "") || null;
  const repeatUntil = String(formData.get("repeatUntil") ?? "") || null;
  const weekdays = formData.getAll("weekdays").map(String); // e.g. ["1","3","5"]

  if (!serviceId || !staffId || !startDate || !timeHHMM) {
    return { ok: false, error: "All fields are required." };
  }
  if (repeatUntil && repeatUntil < startDate) {
    return { ok: false, error: "\"Repeat until\" can't be before the start date." };
  }

  const dates: string[] =
    repeatUntil && weekdays.length > 0
      ? (() => {
          const out: string[] = [];
          for (let d = startDate; d <= repeatUntil; d = addDaysISO(d, 1)) {
            if (weekdays.includes(String(dayOfWeekISO(d)))) out.push(d);
          }
          return out;
        })()
      : [startDate];

  if (dates.length === 0) {
    return { ok: false, error: "No dates matched — pick at least one day of the week." };
  }
  if (dates.length > 52) {
    return { ok: false, error: "That's more than a year of sessions at once — narrow the date range." };
  }

  let created = 0;
  let conflicts = 0;
  for (const dateISO of dates) {
    const result = await createOneSession(owner.businessId, {
      serviceId,
      staffId,
      resourceId,
      dateISO,
      timeHHMM,
    });
    if (result.ok) {
      created++;
    } else if (result.reason === "not_a_class") {
      return { ok: false, error: "That service isn't set up as a class (needs a capacity of 2 or more)." };
    } else if (result.reason === "slot_taken") {
      conflicts++;
    } else {
      return { ok: false, error: "Something went wrong. Please try again." };
    }
  }

  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard/calendar");

  if (created === 0) {
    return { ok: false, error: "That staff member or room already has something scheduled at every one of those times." };
  }
  return {
    ok: true,
    message:
      dates.length === 1
        ? undefined
        : conflicts > 0
          ? `Scheduled ${created} session${created === 1 ? "" : "s"} — skipped ${conflicts} where the time was already taken.`
          : `Scheduled ${created} sessions.`,
  };
}

/** Same idea as bookings' updateBookingNote, scoped to a whole class session. */
export async function updateClassSessionNote(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const sessionId = String(formData.get("sessionId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const flagged = formData.get("flagged") === "on";

  await withBusinessContext(owner.businessId, (c) =>
    c.query(`UPDATE class_sessions SET owner_note = $1, is_flagged = $2 WHERE id = $3`, [
      note || null,
      flagged,
      sessionId,
    ])
  );

  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard/calendar");
}

// bookings.class_session_id has no ON DELETE cascade, and deliberately so
// — a booking keeps pointing at the session it belongs to even after
// that booking is cancelled, so past reports stay accurate. That means
// the DELETE below can be blocked by booking history that seats_booked
// alone doesn't show (seats_booked only counts currently-active
// attendees, not cancelled/no-show/completed ones) — an earlier version
// of this action checked seats_booked and then ran DELETE unguarded,
// which crashed to the dashboard's error boundary on exactly that case
// (a session with only past/cancelled bookings, no live ones). Catching
// the FK violation directly, the same way deleteStaff already does, is
// the one check that's actually authoritative.
export async function deleteClassSession(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();
  const sessionId = String(formData.get("sessionId") ?? "");

  try {
    await withBusinessContext(owner.businessId, (c) =>
      c.query(`DELETE FROM class_sessions WHERE id = $1`, [sessionId])
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23503") {
      return {
        ok: false,
        error:
          "Can't remove a session that has any booking history, including past or cancelled bookings — this keeps existing reports accurate.",
      };
    }
    console.error("deleteClassSession failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard/calendar");
  return { ok: true, message: "Session removed" };
}

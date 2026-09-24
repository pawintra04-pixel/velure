"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { isStaffFreeForRange, isSlotConflictError } from "@/lib/staff-availability";
import { notify } from "@/lib/notifications";

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
  params: {
    serviceId: string;
    staffId: string;
    resourceId: string | null;
    dateISO: string;
    timeHHMM: string;
    seriesId: string | null;
  }
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
        `INSERT INTO class_sessions
           (business_id, service_id, staff_id, start_time, end_time, capacity, resource_id, series_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          businessId,
          params.serviceId,
          params.staffId,
          startTime.toISOString(),
          endTime.toISOString(),
          service.capacity,
          params.resourceId,
          params.seriesId,
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

  // A repeat groups its occurrences under one series_id purely so the
  // Classes page can show them as one entry — each row stays independent.
  const seriesId = dates.length > 1 ? randomUUID() : null;
  let created = 0;
  let conflicts = 0;
  for (const dateISO of dates) {
    const result = await createOneSession(owner.businessId, {
      serviceId,
      staffId,
      resourceId,
      dateISO,
      timeHHMM,
      seriesId,
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

/**
 * Cancels every active attendee's booking in one go, then resets the
 * seat counter — the bulk equivalent of calling updateBookingStatus's
 * CANCELLED transition once per attendee, which is otherwise the only way
 * to empty a session before deleteClassSession's FK guard will allow
 * removing it. Attendees each still get their own cancellation email,
 * same as an individual cancellation would send.
 */
export async function cancelClassSession(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();
  const sessionId = String(formData.get("sessionId") ?? "");

  const cancelledIds = await withBusinessContext(owner.businessId, async (c) => {
    const { rows } = await c.query<{ id: string }>(
      `UPDATE bookings SET status = 'CANCELLED'
       WHERE class_session_id = $1 AND status IN ('TEMPORARY_HOLD', 'PAYMENT_PENDING', 'CONFIRMED')
       RETURNING id`,
      [sessionId]
    );
    await c.query(`UPDATE class_sessions SET seats_booked = 0 WHERE id = $1`, [sessionId]);
    return rows.map((r) => r.id);
  });

  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/bookings");

  for (const id of cancelledIds) void notify("booking_cancelled", id);

  return {
    ok: true,
    message:
      cancelledIds.length === 0
        ? "Session had no active bookings"
        : `Cancelled session and ${cancelledIds.length} booking${cancelledIds.length === 1 ? "" : "s"}`,
  };
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

/**
 * Swap who teaches ONE occurrence (e.g. the usual teacher is sick that
 * day) — never the rest of its series. Attendee bookings carry their own
 * staff_id (Reports group by bookings.staff_id), so they move together
 * with the session in the same transaction; otherwise month-end reports
 * would credit the teacher who didn't actually teach.
 */
export async function reassignClassSessionStaff(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();
  const sessionId = String(formData.get("sessionId") ?? "");
  const staffId = String(formData.get("staffId") ?? "");
  if (!sessionId || !staffId) return { ok: false, error: "Pick a staff member." };

  try {
    await withBusinessContext(owner.businessId, async (c) => {
      const { rows: [session] } = await c.query<{ staff_id: string; start_time: Date; end_time: Date }>(
        `SELECT staff_id, start_time, end_time FROM class_sessions WHERE id = $1 FOR UPDATE`,
        [sessionId]
      );
      if (!session) throw new Error("not_found");
      if (session.staff_id === staffId) throw new Error("same_staff");
      if (
        !(await isStaffFreeForRange(
          c,
          staffId,
          new Date(session.start_time).toISOString(),
          new Date(session.end_time).toISOString()
        ))
      ) {
        throw new Error("slot_taken");
      }
      await c.query(`UPDATE class_sessions SET staff_id = $1 WHERE id = $2`, [staffId, sessionId]);
      await c.query(`UPDATE bookings SET staff_id = $1 WHERE class_session_id = $2`, [staffId, sessionId]);
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "same_staff") return { ok: false, error: "That person is already teaching this session." };
    if (msg === "not_found") return { ok: false, error: "This session no longer exists." };
    if (isSlotConflictError(err) || msg === "slot_taken") {
      return { ok: false, error: "That staff member already has something scheduled at this time." };
    }
    console.error("reassignClassSessionStaff failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/reports");
  return { ok: true, message: "Teacher changed for this session" };
}

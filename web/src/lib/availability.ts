import { withBusinessContext } from "@/db/client";

const SLOT_GRANULARITY_MINUTES = 30;

export type Slot = { startTime: string; endTime: string };

type ServiceInfo = {
  durationMinutes: number;
  bufferMinutes: number;
  staffId: string;
};

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Postgres EXTRACT(DOW)/JS getUTCDay() both use 0=Sunday..6=Saturday.
// dateISO has no time component, so treating it as UTC midnight is just a
// timezone-agnostic way to read back the calendar date's weekday — it's
// not claiming that moment is actually midnight UTC anywhere real.
function dayOfWeek(dateISO: string): number {
  return new Date(`${dateISO}T00:00:00Z`).getUTCDay();
}

/**
 * Slots are a UI convenience only — the actual "is this really free" check
 * is the database's overlap EXCLUDE constraint (see
 * db/migrations/006_bookings.sql), enforced again at insert time in
 * createQuickHold(). A slot listed here can still lose a race to a
 * concurrent booking; that's fine, that's the whole point of
 * spikes/atomic-booking.
 */
export async function getAvailableSlots(
  businessId: string,
  serviceId: string,
  dateISO: string, // "YYYY-MM-DD", interpreted in the business's timezone
  // Reschedule flow: the booking being moved shouldn't count as "occupying"
  // its own current slot, or every reschedule would see its own time as
  // unavailable.
  excludeBookingId?: string
): Promise<Slot[]> {
  return withBusinessContext(businessId, async (c) => {
    const { rows: [service] } = await c.query<{
      duration_minutes: number;
      buffer_minutes: number;
    }>(`SELECT duration_minutes, buffer_minutes FROM services WHERE id = $1`, [serviceId]);
    if (!service) return [];

    // MVP simplification: one staff member per service (first assigned).
    // Real staff-picking UI is future scope.
    const { rows: [assignment] } = await c.query<{ staff_id: string }>(
      `SELECT staff_id FROM staff_services WHERE service_id = $1 LIMIT 1`,
      [serviceId]
    );
    if (!assignment) return [];

    const info: ServiceInfo = {
      durationMinutes: service.duration_minutes,
      bufferMinutes: service.buffer_minutes,
      staffId: assignment.staff_id,
    };

    const dow = dayOfWeek(dateISO);

    const { rows: [bizHours] } = await c.query<{
      is_closed: boolean;
      open_time: string | null;
      close_time: string | null;
    }>(`SELECT is_closed, open_time, close_time FROM business_hours WHERE business_id = $1 AND day_of_week = $2`, [
      businessId,
      dow,
    ]);
    // No row = treat as closed rather than silently falling back to "open
    // all day" — every business gets a full week of rows at signup/backfill,
    // so a missing row means something's wrong, not "unrestricted."
    if (!bizHours || bizHours.is_closed) return [];

    const { rows: [staffHours] } = await c.query<{
      is_off: boolean;
      start_time: string | null;
      end_time: string | null;
      break_start: string | null;
      break_end: string | null;
    }>(
      `SELECT is_off, start_time, end_time, break_start, break_end
       FROM staff_hours WHERE staff_id = $1 AND day_of_week = $2`,
      [info.staffId, dow]
    );
    if (!staffHours || staffHours.is_off) return [];

    // Effective window is the overlap of the business's hours and this
    // staff member's own hours for the day — a staff member can't be
    // bookable before the shop opens, after it closes, or outside their
    // own shift even if the shop is open later.
    const openMinutes = Math.max(timeToMinutes(bizHours.open_time!), timeToMinutes(staffHours.start_time!));
    const closeMinutes = Math.min(timeToMinutes(bizHours.close_time!), timeToMinutes(staffHours.end_time!));
    if (openMinutes >= closeMinutes) return [];

    const breakRange =
      staffHours.break_start && staffHours.break_end
        ? { start: timeToMinutes(staffHours.break_start), end: timeToMinutes(staffHours.break_end) }
        : null;

    const { rows: existingBookings } = await c.query<{
      start_time: string;
      end_time: string;
    }>(
      // hold_expires_at check matters even though createQuickHold also
      // sweeps stale holds to EXPIRED before inserting — a read here can
      // land between two writes and see an abandoned hold nobody has
      // attempted to re-book yet, which would otherwise show a genuinely
      // free slot as taken.
      //
      // Also pulls in this staff member's class_sessions for the day — a
      // class occupies them exclusively too, and unlike a real overlap
      // between two 1:1 bookings (an actual race), a slot colliding with an
      // already-scheduled class is a certainty, not a race, so it's worth
      // filtering out here rather than letting the customer hit
      // createQuickHold's "slot just taken" only to find out at insert time.
      `SELECT start_time, end_time FROM bookings
       WHERE staff_id = $1
         AND status IN ('TEMPORARY_HOLD', 'PAYMENT_PENDING', 'CONFIRMED')
         AND (hold_expires_at IS NULL OR hold_expires_at >= now())
         AND start_time::date = $2::date
         AND ($3::uuid IS NULL OR id != $3::uuid)
       UNION ALL
       SELECT start_time, end_time FROM class_sessions
       WHERE staff_id = $1 AND start_time::date = $2::date`,
      [info.staffId, dateISO, excludeBookingId ?? null]
    );

    return buildSlots(dateISO, info, existingBookings, openMinutes, closeMinutes, breakRange);
  });
}

function buildSlots(
  dateISO: string,
  info: ServiceInfo,
  existing: { start_time: string; end_time: string }[],
  openMinutes: number,
  closeMinutes: number,
  breakRange: { start: number; end: number } | null
): Slot[] {
  const slots: Slot[] = [];
  const now = new Date();
  const dayStart = new Date(`${dateISO}T00:00:00+07:00`);

  const occupiedRanges = existing.map((b) => ({
    start: new Date(b.start_time).getTime(),
    end: new Date(b.end_time).getTime(),
  }));
  if (breakRange) {
    occupiedRanges.push({
      start: dayStart.getTime() + breakRange.start * 60_000,
      end: dayStart.getTime() + breakRange.end * 60_000,
    });
  }

  const totalBlockMinutes = info.durationMinutes + info.bufferMinutes;

  for (
    let minutes = openMinutes;
    minutes + totalBlockMinutes <= closeMinutes;
    minutes += SLOT_GRANULARITY_MINUTES
  ) {
    const start = new Date(dayStart.getTime() + minutes * 60_000);
    const end = new Date(start.getTime() + totalBlockMinutes * 60_000);

    if (start <= now) continue;

    const overlaps = occupiedRanges.some(
      (r) => start.getTime() < r.end && end.getTime() > r.start
    );
    if (overlaps) continue;

    slots.push({ startTime: start.toISOString(), endTime: end.toISOString() });
  }

  return slots;
}

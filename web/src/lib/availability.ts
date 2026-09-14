import { withBusinessContext } from "@/db/client";

// STUB: no working-hours/business-hours data model exists yet (that's part
// of the Business Setup engine, not built). Hardcoded so the booking flow
// can be proven end-to-end; replace with a real per-business schedule
// later. Asia/Bangkok, 09:00-19:00, matching the seeded demo business.
const BUSINESS_OPEN_HOUR = 9;
const BUSINESS_CLOSE_HOUR = 19;
const SLOT_GRANULARITY_MINUTES = 30;

export type Slot = { startTime: string; endTime: string };

type ServiceInfo = {
  durationMinutes: number;
  bufferMinutes: number;
  staffId: string;
};

/**
 * Slots are a UI convenience only — the actual "is this really free" check
 * is the database's overlap EXCLUDE constraint (see
 * db/migrations/006_bookings.sql), enforced again at insert time in
 * createHold(). A slot listed here can still lose a race to a concurrent
 * booking; that's fine, that's the whole point of spikes/atomic-booking.
 */
export async function getAvailableSlots(
  businessId: string,
  serviceId: string,
  dateISO: string // "YYYY-MM-DD", interpreted in the business's timezone
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

    const { rows: existingBookings } = await c.query<{
      start_time: string;
      end_time: string;
    }>(
      `SELECT start_time, end_time FROM bookings
       WHERE staff_id = $1
         AND status IN ('TEMPORARY_HOLD', 'PAYMENT_PENDING', 'CONFIRMED')
         AND start_time::date = $2::date`,
      [info.staffId, dateISO]
    );

    return buildSlots(dateISO, info, existingBookings);
  });
}

function buildSlots(
  dateISO: string,
  info: ServiceInfo,
  existing: { start_time: string; end_time: string }[]
): Slot[] {
  const slots: Slot[] = [];
  const now = new Date();
  const occupiedRanges = existing.map((b) => ({
    start: new Date(b.start_time).getTime(),
    end: new Date(b.end_time).getTime(),
  }));

  const dayStart = new Date(`${dateISO}T00:00:00+07:00`);
  const totalBlockMinutes = info.durationMinutes + info.bufferMinutes;

  for (
    let minutes = BUSINESS_OPEN_HOUR * 60;
    minutes + totalBlockMinutes <= BUSINESS_CLOSE_HOUR * 60;
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

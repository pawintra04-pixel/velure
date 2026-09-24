import { withBusinessContext } from "@/db/client";

export type CalendarBooking = {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  amount: number;
  serviceName: string;
  staffId: string;
  staffName: string;
  customerName: string | null;
  hasPayment: boolean;
  classSessionId: string | null;
  packagePurchaseId: string | null;
  ownerNote: string | null;
  isFlagged: boolean;
  paymentMethod: string | null;
  refundedAmount: number | null;
  refundedAt: string | null;
  /** Only set for staff-created bookings — see 033_manual_payment_and_class_series.sql. */
  amountPaid: number | null;
  paymentNote: string | null;
};

export async function getBookingsInRange(
  businessId: string,
  startISO: string,
  endISO: string
): Promise<CalendarBooking[]> {
  return withBusinessContext(businessId, async (c) => {
    const { rows } = await c.query(
      `SELECT b.id, b.start_time, b.end_time, b.status, b.amount, b.stripe_payment_intent_id,
              b.class_session_id, b.package_purchase_id, b.owner_note, b.is_flagged, b.payment_method,
              b.refunded_amount, b.refunded_at, b.amount_paid, b.payment_note,
              s.name AS service_name, st.id AS staff_id, st.name AS staff_name,
              cu.name AS customer_name
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN staff st ON st.id = b.staff_id
       LEFT JOIN customers cu ON cu.id = b.customer_id
       WHERE b.start_time >= $1 AND b.start_time < $2
       ORDER BY b.start_time ASC`,
      [startISO, endISO]
    );
    return rows.map((r) => ({
      id: r.id,
      startTime: r.start_time,
      endTime: r.end_time,
      status: r.status,
      amount: r.amount,
      serviceName: r.service_name,
      staffId: r.staff_id,
      staffName: r.staff_name,
      customerName: r.customer_name,
      hasPayment: Boolean(r.stripe_payment_intent_id),
      classSessionId: r.class_session_id,
      packagePurchaseId: r.package_purchase_id,
      ownerNote: r.owner_note,
      isFlagged: r.is_flagged,
      paymentMethod: r.payment_method,
      refundedAmount: r.refunded_amount,
      refundedAt: r.refunded_at,
      amountPaid: r.amount_paid,
      paymentNote: r.payment_note,
    }));
  });
}

export type CalendarClassSession = {
  id: string;
  startTime: string;
  endTime: string;
  staffId: string;
  staffName: string;
  serviceName: string;
  resourceName: string | null;
  capacity: number;
  seatsBooked: number;
  ownerNote: string | null;
  isFlagged: boolean;
};

export async function getClassSessionsInRange(
  businessId: string,
  startISO: string,
  endISO: string
): Promise<CalendarClassSession[]> {
  return withBusinessContext(businessId, async (c) => {
    const { rows } = await c.query(
      `SELECT cs.id, cs.start_time, cs.end_time, cs.staff_id, cs.capacity, cs.seats_booked,
              cs.owner_note, cs.is_flagged, s.name AS service_name, st.name AS staff_name,
              r.name AS resource_name
       FROM class_sessions cs
       JOIN services s ON s.id = cs.service_id
       JOIN staff st ON st.id = cs.staff_id
       LEFT JOIN resources r ON r.id = cs.resource_id
       WHERE cs.start_time >= $1 AND cs.start_time < $2
       ORDER BY cs.start_time ASC`,
      [startISO, endISO]
    );
    return rows.map((r) => ({
      id: r.id,
      startTime: r.start_time,
      endTime: r.end_time,
      staffId: r.staff_id,
      staffName: r.staff_name,
      serviceName: r.service_name,
      resourceName: r.resource_name,
      capacity: r.capacity,
      seatsBooked: r.seats_booked,
      ownerNote: r.owner_note,
      isFlagged: r.is_flagged,
    }));
  });
}

export type CalendarStaffBlock = {
  id: string;
  startTime: string;
  endTime: string;
  staffId: string;
  reason: string | null;
};

export async function getStaffBlocksInRange(
  businessId: string,
  startISO: string,
  endISO: string
): Promise<CalendarStaffBlock[]> {
  return withBusinessContext(businessId, async (c) => {
    const { rows } = await c.query(
      `SELECT id, start_time, end_time, staff_id, reason
       FROM staff_blocks
       WHERE start_time >= $1 AND start_time < $2
       ORDER BY start_time ASC`,
      [startISO, endISO]
    );
    return rows.map((r) => ({
      id: r.id,
      startTime: r.start_time,
      endTime: r.end_time,
      staffId: r.staff_id,
      reason: r.reason,
    }));
  });
}

// "YYYY-MM-DD" in Asia/Bangkok -> a real instant at 00:00 local time.
// Same technique as availability.ts — business timezone is hardcoded there
// too, pending a real working-hours/timezone data model.
export function bangkokMidnight(dateISO: string): Date {
  return new Date(`${dateISO}T00:00:00+07:00`);
}

export function todayISOInBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

export function addDays(dateISO: string, days: number): string {
  const d = bangkokMidnight(dateISO);
  d.setUTCDate(d.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d);
}

export function startOfWeek(dateISO: string): string {
  // getUTCDay on the bangkok-midnight instant is safe here specifically
  // because it IS exactly local midnight, so its UTC calendar day still
  // matches the intended local calendar day.
  const jsDay = bangkokMidnight(dateISO).getUTCDay(); // 0 (Sun) .. 6 (Sat)
  return addDays(dateISO, -jsDay);
}

export function startOfMonth(dateISO: string): string {
  return dateISO.slice(0, 7) + "-01";
}

export function addMonths(dateISO: string, months: number): string {
  const [y, m] = dateISO.split("-").map(Number);
  const total = (m - 1) + months;
  const newYear = y + Math.floor(total / 12);
  const newMonth = ((total % 12) + 12) % 12;
  return `${newYear}-${String(newMonth + 1).padStart(2, "0")}-01`;
}

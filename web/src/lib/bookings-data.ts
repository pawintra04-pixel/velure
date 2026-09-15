import { withBusinessContext } from "@/db/client";

export type CalendarBooking = {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  amount: number;
  serviceName: string;
  staffName: string;
  customerName: string | null;
  hasPayment: boolean;
};

export async function getBookingsInRange(
  businessId: string,
  startISO: string,
  endISO: string
): Promise<CalendarBooking[]> {
  return withBusinessContext(businessId, async (c) => {
    const { rows } = await c.query(
      `SELECT b.id, b.start_time, b.end_time, b.status, b.amount, b.stripe_payment_intent_id,
              s.name AS service_name, st.name AS staff_name, cu.name AS customer_name
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
      staffName: r.staff_name,
      customerName: r.customer_name,
      hasPayment: Boolean(r.stripe_payment_intent_id),
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

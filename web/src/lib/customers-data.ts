import { withBusinessContext } from "@/db/client";
import type { CalendarBooking } from "@/lib/bookings-data";

export type CustomerListRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  bookingCount: number;
};

// Search is a plain ILIKE across the three fields an owner would actually
// remember a customer by — fine at pilot scale (no full-text index needed
// yet); business_id is always bound through withBusinessContext, never
// taken from the query string.
export async function searchCustomers(businessId: string, q: string | null): Promise<CustomerListRow[]> {
  return withBusinessContext(businessId, async (c) => {
    const { rows } = await c.query(
      `SELECT c.id, c.name, c.phone, c.email,
              (SELECT count(*)::int FROM bookings b WHERE b.customer_id = c.id) AS booking_count
       FROM customers c
       WHERE ($1::text IS NULL OR c.name ILIKE '%' || $1 || '%'
              OR c.phone ILIKE '%' || $1 || '%'
              OR c.email ILIKE '%' || $1 || '%')
       ORDER BY c.created_at DESC
       LIMIT 200`,
      [q || null]
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      bookingCount: r.booking_count,
    }));
  });
}

export type CustomerDetail = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
};

export async function getCustomer(businessId: string, customerId: string): Promise<CustomerDetail | null> {
  return withBusinessContext(businessId, async (c) => {
    const { rows: [row] } = await c.query(
      `SELECT id, name, phone, email, notes, created_at FROM customers WHERE id = $1`,
      [customerId]
    );
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      notes: row.notes,
      createdAt: row.created_at,
    };
  });
}

// Reuses the exact CalendarBooking shape BookingRow/BookingList already
// render, so a customer's history is just another list of the same rows
// the rest of the dashboard uses — no new presentation component needed.
export async function getBookingsForCustomer(
  businessId: string,
  customerId: string
): Promise<CalendarBooking[]> {
  return withBusinessContext(businessId, async (c) => {
    const { rows } = await c.query(
      `SELECT b.id, b.start_time, b.end_time, b.status, b.amount, b.stripe_payment_intent_id,
              b.class_session_id, b.owner_note, b.is_flagged, b.payment_method,
              s.name AS service_name, st.id AS staff_id, st.name AS staff_name,
              cu.name AS customer_name
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN staff st ON st.id = b.staff_id
       LEFT JOIN customers cu ON cu.id = b.customer_id
       WHERE b.customer_id = $1
       ORDER BY b.start_time DESC
       LIMIT 200`,
      [customerId]
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
      ownerNote: r.owner_note,
      isFlagged: r.is_flagged,
      paymentMethod: r.payment_method,
    }));
  });
}

import { withBusinessContext } from "@/db/client";
import type { CalendarBooking } from "@/lib/bookings-data";

export type SellablePackage = {
  id: string;
  name: string;
  serviceId: string;
  serviceName: string;
  sessionCount: number;
  priceAmount: number;
};

// Every active package any service currently offers — for the "sell a
// package" picker on a customer's page. Deliberately not scoped to one
// service (a customer's page doesn't start from "which service" the way
// ServiceCard's own package list does), so this lists across all of them.
export async function listSellablePackages(businessId: string): Promise<SellablePackage[]> {
  return withBusinessContext(businessId, async (c) => {
    const { rows } = await c.query(
      `SELECT p.id, p.name, p.service_id, s.name AS service_name, p.session_count, p.price_amount
       FROM packages p
       JOIN services s ON s.id = p.service_id
       WHERE p.is_active
       ORDER BY s.name, p.name`
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      serviceId: r.service_id,
      serviceName: r.service_name,
      sessionCount: r.session_count,
      priceAmount: r.price_amount,
    }));
  });
}

export type CustomerListRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  bookingCount: number;
  totalSpend: number; // satang, settled bookings only
  lastVisit: string | null;
  noShowCount: number;
  tags: string[];
};

const SETTLED = ["CONFIRMED", "COMPLETED"];
// For revenue sums only (never for visit/booking counts) — a booking that
// was later partially or fully refunded is still a real revenue event, just
// reduced by whatever came back. Excluding REFUNDED/PARTIALLY_REFUNDED
// entirely (the old behavior) silently dropped a PARTIALLY_REFUNDED
// booking's whole original amount instead of just the refunded part; a
// fully REFUNDED booking nets to 0 here automatically since
// refunded_amount equals amount, so this changes nothing for full refunds.
const SETTLED_OR_REFUNDED = [...SETTLED, "REFUNDED", "PARTIALLY_REFUNDED"];

// Search is a plain ILIKE across the three fields an owner would actually
// remember a customer by — fine at pilot scale (no full-text index needed
// yet); business_id is always bound through withBusinessContext, never
// taken from the query string. tag is an exact match against the tags
// array (= ANY, not ILIKE) — tags are short fixed labels an owner picked,
// not free text to fuzzy-search.
export async function searchCustomers(
  businessId: string,
  q: string | null,
  tag: string | null = null
): Promise<CustomerListRow[]> {
  return withBusinessContext(businessId, async (c) => {
    const { rows } = await c.query(
      `SELECT c.id, c.name, c.phone, c.email, c.tags,
              (SELECT count(*)::int FROM bookings b WHERE b.customer_id = c.id) AS booking_count,
              (SELECT coalesce(sum(b.amount - coalesce(b.refunded_amount, 0)), 0)::int FROM bookings b
                 WHERE b.customer_id = c.id AND b.status = ANY($3::booking_status[])) AS total_spend,
              (SELECT max(b.start_time) FROM bookings b
                 WHERE b.customer_id = c.id AND b.status = ANY($4::booking_status[])) AS last_visit,
              (SELECT count(*)::int FROM bookings b
                 WHERE b.customer_id = c.id AND b.status = 'NO_SHOW') AS no_show_count
       FROM customers c
       WHERE ($1::text IS NULL OR c.name ILIKE '%' || $1 || '%'
              OR c.phone ILIKE '%' || $1 || '%'
              OR c.email ILIKE '%' || $1 || '%')
         AND ($2::text IS NULL OR $2 = ANY(c.tags))
       ORDER BY c.created_at DESC
       LIMIT 200`,
      [q || null, tag || null, SETTLED_OR_REFUNDED, SETTLED]
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      bookingCount: r.booking_count,
      totalSpend: r.total_spend,
      lastVisit: r.last_visit,
      noShowCount: r.no_show_count,
      tags: r.tags,
    }));
  });
}

// Every distinct tag currently in use, for the filter dropdown — no
// separate tags table (see 026_customer_tags.sql), so this is just a
// DISTINCT unnest over customers.tags.
export async function listUsedTags(businessId: string): Promise<string[]> {
  return withBusinessContext(businessId, async (c) => {
    const { rows } = await c.query(
      `SELECT DISTINCT unnest(tags) AS tag FROM customers ORDER BY tag`
    );
    return rows.map((r) => r.tag);
  });
}

export type CustomerDetail = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  tags: string[];
  createdAt: string;
  totalSpend: number; // satang, settled bookings only
  visitCount: number; // settled bookings only, distinct from bookingCount (which includes cancelled/holds)
  noShowCount: number;
  lastVisit: string | null;
};

export async function getCustomer(businessId: string, customerId: string): Promise<CustomerDetail | null> {
  return withBusinessContext(businessId, async (c) => {
    const { rows: [row] } = await c.query(
      `SELECT c.id, c.name, c.phone, c.email, c.notes, c.tags, c.created_at,
              (SELECT coalesce(sum(b.amount - coalesce(b.refunded_amount, 0)), 0)::int FROM bookings b
                 WHERE b.customer_id = c.id AND b.status = ANY($3::booking_status[])) AS total_spend,
              (SELECT count(*)::int FROM bookings b
                 WHERE b.customer_id = c.id AND b.status = ANY($2::booking_status[])) AS visit_count,
              (SELECT count(*)::int FROM bookings b
                 WHERE b.customer_id = c.id AND b.status = 'NO_SHOW') AS no_show_count,
              (SELECT max(b.start_time) FROM bookings b
                 WHERE b.customer_id = c.id AND b.status = ANY($2::booking_status[])) AS last_visit
       FROM customers c WHERE c.id = $1`,
      [customerId, SETTLED, SETTLED_OR_REFUNDED]
    );
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      notes: row.notes,
      tags: row.tags,
      createdAt: row.created_at,
      totalSpend: row.total_spend,
      visitCount: row.visit_count,
      noShowCount: row.no_show_count,
      lastVisit: row.last_visit,
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
              b.class_session_id, b.package_purchase_id, b.owner_note, b.is_flagged, b.payment_method,
              b.refunded_amount, b.refunded_at,
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
      packagePurchaseId: r.package_purchase_id,
      ownerNote: r.owner_note,
      isFlagged: r.is_flagged,
      paymentMethod: r.payment_method,
      refundedAmount: r.refunded_amount,
      refundedAt: r.refunded_at,
    }));
  });
}

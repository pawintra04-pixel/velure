import { adminPool } from "@/db/client";

// Every query here deliberately goes through adminPool (bypasses RLS) —
// this is the one legitimate place in the app that reads across every
// business at once, gated by requireAdmin() at the page level rather than
// by tenant isolation. See db/client.ts's doc comment on adminPool.
const SETTLED = ["CONFIRMED", "COMPLETED"];

export type PlatformOverview = {
  businessCount: number;
  totalBookings: number;
  totalRevenue: number; // satang, settled bookings only
  newBusinessesLast30d: number;
};

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const { rows: [row] } = await adminPool.query(
    `SELECT
       (SELECT count(*)::int FROM businesses) AS business_count,
       (SELECT count(*)::int FROM bookings WHERE status = ANY($1::booking_status[])) AS total_bookings,
       (SELECT coalesce(sum(amount), 0)::int FROM bookings WHERE status = ANY($1::booking_status[])) AS total_revenue,
       (SELECT count(*)::int FROM businesses WHERE created_at >= now() - interval '30 days') AS new_businesses_last_30d`,
    [SETTLED]
  );
  return {
    businessCount: row.business_count,
    totalBookings: row.total_bookings,
    totalRevenue: row.total_revenue,
    newBusinessesLast30d: row.new_businesses_last_30d,
  };
}

export type BusinessSummaryRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  ownerEmail: string | null;
  bookingCount: number;
  revenue: number; // satang, settled bookings only
  hasStripeAccount: boolean;
};

export async function listBusinessSummaries(): Promise<BusinessSummaryRow[]> {
  const { rows } = await adminPool.query(
    `SELECT
       b.id, b.name, b.slug, b.created_at,
       o.email AS owner_email,
       (b.stripe_account_id IS NOT NULL) AS has_stripe_account,
       count(bk.id) FILTER (WHERE bk.status = ANY($1::booking_status[]))::int AS booking_count,
       coalesce(sum(bk.amount) FILTER (WHERE bk.status = ANY($1::booking_status[])), 0)::int AS revenue
     FROM businesses b
     LEFT JOIN owners o ON o.business_id = b.id
     LEFT JOIN bookings bk ON bk.business_id = b.id
     GROUP BY b.id, b.name, b.slug, b.created_at, o.email, b.stripe_account_id
     ORDER BY b.created_at DESC`,
    [SETTLED]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    createdAt: r.created_at,
    ownerEmail: r.owner_email,
    bookingCount: r.booking_count,
    revenue: r.revenue,
    hasStripeAccount: r.has_stripe_account,
  }));
}

export type AppErrorRow = {
  id: string;
  occurredAt: string;
  routePath: string | null;
  routeType: string | null;
  message: string;
  businessName: string | null;
};

export async function listRecentErrors(limit = 50): Promise<AppErrorRow[]> {
  const { rows } = await adminPool.query(
    `SELECT e.id, e.occurred_at, e.route_path, e.route_type, e.message, b.name AS business_name
     FROM app_errors e
     LEFT JOIN businesses b ON b.id = e.business_id
     ORDER BY e.occurred_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({
    id: r.id,
    occurredAt: r.occurred_at,
    routePath: r.route_path,
    routeType: r.route_type,
    message: r.message,
    businessName: r.business_name,
  }));
}

export type NotificationFailureRow = {
  id: string;
  attemptedAt: string;
  eventType: string;
  channel: string;
  error: string | null;
  retryCount: number;
  businessName: string | null;
};

// 'skipped' rows are excluded on purpose — that's "nothing to send to"
// (no email/phone/LINE on file), a normal outcome, not something the
// platform operator needs to act on. Only 'failed' (an actual send
// attempt that errored) belongs here.
export async function listRecentNotificationFailures(limit = 50): Promise<NotificationFailureRow[]> {
  const { rows } = await adminPool.query(
    `SELECT n.id, n.attempted_at, n.event_type, n.channel, n.error, n.retry_count, b.name AS business_name
     FROM notification_log n
     LEFT JOIN businesses b ON b.id = n.business_id
     WHERE n.status = 'failed'
     ORDER BY n.attempted_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({
    id: r.id,
    attemptedAt: r.attempted_at,
    eventType: r.event_type,
    channel: r.channel,
    error: r.error,
    retryCount: r.retry_count,
    businessName: r.business_name,
  }));
}

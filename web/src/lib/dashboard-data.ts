import { withBusinessContext } from "@/db/client";
import { stripe } from "@/lib/stripe";
import { todayISOInBangkok, bangkokMidnight, addDays } from "@/lib/bookings-data";

// All of these go through withBusinessContext (real app_user role, real RLS)
// rather than adminPool — this is what every future page's data access
// should look like once real auth supplies the business id, per
// db/client.ts's guidance.

export type StatTiles = {
  todayBookings: number;
  monthRevenueSatang: number;
  pendingPayment: number;
  totalCustomers: number;
};

export async function getStatTiles(businessId: string): Promise<StatTiles> {
  return withBusinessContext(businessId, async (c) => {
    // One round trip: a pg.PoolClient handles one query at a time, so these
    // scalar aggregates are subqueries rather than parallel c.query() calls.
    const { rows: [row] } = await c.query(
      `SELECT
         (SELECT count(*)::int FROM bookings
            WHERE status IN ('CONFIRMED', 'COMPLETED')
              AND start_time::date = now()::date) AS today_bookings,
         (SELECT coalesce(sum(amount), 0)::int FROM bookings
            WHERE status IN ('CONFIRMED', 'COMPLETED')
              AND date_trunc('month', start_time) = date_trunc('month', now())) AS month_revenue,
         (SELECT count(*)::int FROM bookings
            WHERE status IN ('TEMPORARY_HOLD', 'PAYMENT_PENDING')) AS pending_payment,
         (SELECT count(*)::int FROM customers) AS total_customers`
    );

    return {
      todayBookings: row.today_bookings,
      monthRevenueSatang: row.month_revenue,
      pendingPayment: row.pending_payment,
      totalCustomers: row.total_customers,
    };
  });
}

export type MonthlyRevenuePoint = { label: string; totalSatang: number };

export async function getMonthlyRevenue(businessId: string): Promise<MonthlyRevenuePoint[]> {
  return withBusinessContext(businessId, async (c) => {
    const { rows } = await c.query(
      `SELECT
         date_trunc('month', start_time) AS month,
         sum(amount)::int AS total
       FROM bookings
       WHERE status IN ('CONFIRMED', 'COMPLETED')
         AND start_time >= date_trunc('year', now())
       GROUP BY 1
       ORDER BY 1`
    );

    const byMonth = new Map<number, number>(
      rows.map((r) => [new Date(r.month).getMonth(), r.total])
    );

    const monthLabels = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const currentMonth = new Date().getMonth();

    return monthLabels.slice(0, currentMonth + 1).map((label, i) => ({
      label,
      totalSatang: byMonth.get(i) ?? 0,
    }));
  });
}

// Whether the sidebar's Classes/Resources entries should read as "not set
// up yet" — real EXISTS checks against the same tables/columns those pages
// already use to decide the same thing (a class-capable service needs
// capacity >= 2, per migration 013; see classes/page.tsx), not a new
// concept invented for the sidebar.
export type NavSetupStatus = { classesConfigured: boolean; resourcesConfigured: boolean };

export async function getNavSetupStatus(businessId: string): Promise<NavSetupStatus> {
  return withBusinessContext(businessId, async (c) => {
    const { rows: [row] } = await c.query(
      `SELECT
         EXISTS(SELECT 1 FROM services WHERE capacity IS NOT NULL AND capacity >= 2) AS classes_configured,
         EXISTS(SELECT 1 FROM resources) AS resources_configured`
    );
    return {
      classesConfigured: row.classes_configured,
      resourcesConfigured: row.resources_configured,
    };
  });
}

// Real "today, everything" feed for the Overview page's schedule — mixes
// regular bookings AND class sessions (one row per session, not one per
// attendee — a class with 8 attendees would otherwise bury everything
// else), bounded to the business's calendar day (Asia/Bangkok, matching
// every other date-bound query in bookings-data.ts) rather than "next 8
// regardless of date." Every status is included, cancelled/no-show
// included, so this genuinely reads as "what happened/will happen today,"
// not just the active subset — an owner scanning Overview should see a
// cancellation here, the same way they'd see it on the Calendar day view.
// Flag/note (migration 018) surfaces here too since that's exactly the
// "needs special attention" info this widget exists to not bury.
export type TodayScheduleEntry = {
  kind: "booking" | "class";
  id: string;
  startTime: string;
  status: string | null; // null for a class — it has no single booking status
  title: string; // customer name for a booking, service name for a class
  serviceName: string;
  staffName: string;
  resourceName: string | null; // class only
  seatsBooked: number | null;
  capacity: number | null;
  ownerNote: string | null;
  isFlagged: boolean;
};

export async function getTodaySchedule(businessId: string): Promise<TodayScheduleEntry[]> {
  const todayISO = todayISOInBangkok();
  const startOfDay = bangkokMidnight(todayISO).toISOString();
  const endOfDay = bangkokMidnight(addDays(todayISO, 1)).toISOString();

  return withBusinessContext(businessId, async (c) => {
    const { rows } = await c.query(
      `(
         SELECT 'booking' AS kind, b.id, b.start_time, b.status::text AS status,
                coalesce(cu.name, 'Unnamed customer') AS title,
                s.name AS service_name, st.name AS staff_name,
                NULL::text AS resource_name,
                NULL::int AS seats_booked, NULL::int AS capacity,
                b.owner_note, b.is_flagged
         FROM bookings b
         JOIN services s ON s.id = b.service_id
         JOIN staff st ON st.id = b.staff_id
         LEFT JOIN customers cu ON cu.id = b.customer_id
         WHERE b.start_time >= $1 AND b.start_time < $2
           AND b.class_session_id IS NULL
       )
       UNION ALL
       (
         SELECT 'class' AS kind, cs.id, cs.start_time, NULL::text AS status,
                s.name AS title,
                s.name AS service_name, st.name AS staff_name,
                r.name AS resource_name,
                cs.seats_booked, cs.capacity,
                cs.owner_note, cs.is_flagged
         FROM class_sessions cs
         JOIN services s ON s.id = cs.service_id
         JOIN staff st ON st.id = cs.staff_id
         LEFT JOIN resources r ON r.id = cs.resource_id
         WHERE cs.start_time >= $1 AND cs.start_time < $2
       )
       ORDER BY start_time ASC`,
      [startOfDay, endOfDay]
    );

    return rows.map((r) => ({
      kind: r.kind,
      id: r.id,
      startTime: r.start_time,
      status: r.status,
      title: r.title,
      serviceName: r.service_name,
      staffName: r.staff_name,
      resourceName: r.resource_name,
      seatsBooked: r.seats_booked,
      capacity: r.capacity,
      ownerNote: r.owner_note,
      isFlagged: r.is_flagged,
    }));
  });
}

// "Needs attention" — three independent, real conditions (not a generic
// rules engine): payments awaiting confirmation, the soonest of those that
// still needs one, and Stripe onboarding. Each is null/absent when the
// real condition isn't true, so the Overview page can render anywhere from
// zero to three items — never a fabricated fixed count.
export type AttentionItems = {
  pendingPayments: { count: number; totalSatang: number } | null;
  nextUnpaid: {
    bookingId: string;
    customerName: string;
    startTime: string;
    serviceName: string;
  } | null;
  stripeSetupIncomplete: boolean;
};

export async function getAttentionItems(businessId: string): Promise<AttentionItems> {
  const { pending, nextUnpaid, stripeAccountId } = await withBusinessContext(
    businessId,
    async (c) => {
      const { rows: [agg] } = await c.query(
        `SELECT count(*)::int AS cnt, coalesce(sum(amount), 0)::int AS total
         FROM bookings WHERE status IN ('TEMPORARY_HOLD', 'PAYMENT_PENDING')`
      );
      const { rows: [next] } = await c.query(
        `SELECT b.id, coalesce(cu.name, 'Unnamed customer') AS customer_name,
                b.start_time, s.name AS service_name
         FROM bookings b
         JOIN services s ON s.id = b.service_id
         LEFT JOIN customers cu ON cu.id = b.customer_id
         WHERE b.status IN ('TEMPORARY_HOLD', 'PAYMENT_PENDING')
         ORDER BY b.start_time ASC
         LIMIT 1`
      );
      const { rows: [biz] } = await c.query(
        `SELECT stripe_account_id FROM businesses WHERE id = $1`,
        [businessId]
      );
      return { pending: agg, nextUnpaid: next ?? null, stripeAccountId: biz.stripe_account_id as string | null };
    }
  );

  // Same live check Settings' PaymentsSection uses — not cached, so an
  // owner who just finished Stripe onboarding sees it clear immediately.
  const chargesEnabled = stripeAccountId
    ? (await stripe.accounts.retrieve(stripeAccountId)).charges_enabled
    : false;

  return {
    pendingPayments: pending.cnt > 0 ? { count: pending.cnt, totalSatang: pending.total } : null,
    nextUnpaid: nextUnpaid
      ? {
          bookingId: nextUnpaid.id,
          customerName: nextUnpaid.customer_name,
          startTime: nextUnpaid.start_time,
          serviceName: nextUnpaid.service_name,
        }
      : null,
    stripeSetupIncomplete: !chargesEnabled,
  };
}

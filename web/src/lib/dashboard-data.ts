import { withBusinessContext } from "@/db/client";

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
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
    ];
    const currentMonth = new Date().getMonth();

    return monthLabels.slice(0, currentMonth + 1).map((label, i) => ({
      label,
      totalSatang: byMonth.get(i) ?? 0,
    }));
  });
}

export type UpcomingBooking = {
  id: string;
  startTime: string;
  customerName: string | null;
  serviceName: string;
  staffName: string;
  status: string;
};

export async function getUpcomingBookings(businessId: string): Promise<UpcomingBooking[]> {
  return withBusinessContext(businessId, async (c) => {
    const { rows } = await c.query(
      `SELECT
         b.id,
         b.start_time,
         b.status,
         c.name AS customer_name,
         s.name AS service_name,
         st.name AS staff_name
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN staff st ON st.id = b.staff_id
       LEFT JOIN customers c ON c.id = b.customer_id
       WHERE b.start_time > now()
         AND b.status IN ('TEMPORARY_HOLD', 'PAYMENT_PENDING', 'CONFIRMED')
       ORDER BY b.start_time ASC
       LIMIT 5`
    );

    return rows.map((r) => ({
      id: r.id,
      startTime: r.start_time,
      customerName: r.customer_name,
      serviceName: r.service_name,
      staffName: r.staff_name,
      status: r.status,
    }));
  });
}

import { withBusinessContext } from "@/db/client";
import { bangkokMidnight, addDays, addMonths, startOfWeek, startOfMonth } from "@/lib/bookings-data";

export type ReportRangeKey = "week" | "month" | "year" | "all";

// Each range spans its FULL period (including days after "today" that fall
// within it), matching the dashboard's own "this month" revenue calculation
// — a confirmed future booking later this month is real, already-collected
// revenue, not something to hide until its date arrives.
export function resolveReportRange(
  rangeKey: ReportRangeKey,
  today: string
): { startISO: string; endISO: string; label: string } {
  switch (rangeKey) {
    case "week":
      return {
        startISO: bangkokMidnight(startOfWeek(today)).toISOString(),
        endISO: bangkokMidnight(addDays(startOfWeek(today), 7)).toISOString(),
        label: "This week",
      };
    case "year":
      return {
        startISO: bangkokMidnight(today.slice(0, 4) + "-01-01").toISOString(),
        endISO: bangkokMidnight(String(Number(today.slice(0, 4)) + 1) + "-01-01").toISOString(),
        label: "This year",
      };
    case "all":
      return {
        startISO: bangkokMidnight("2000-01-01").toISOString(),
        endISO: bangkokMidnight("2100-01-01").toISOString(),
        label: "All time",
      };
    case "month":
    default:
      return {
        startISO: bangkokMidnight(startOfMonth(today)).toISOString(),
        endISO: bangkokMidnight(addMonths(startOfMonth(today), 1)).toISOString(),
        label: "This month",
      };
  }
}

export type ReportOverview = {
  settledBookings: number;
  totalRevenue: number;
  avgBookingValue: number;
  cancelledCount: number;
  noShowCount: number;
  cancellationRate: number; // 0..1
};

export type ReportBreakdownRow = { name: string; bookings: number; revenue: number };

export type ReportData = {
  overview: ReportOverview;
  byStaff: ReportBreakdownRow[];
  byService: ReportBreakdownRow[];
};

const SETTLED = ["CONFIRMED", "COMPLETED"];

export async function getReportData(
  businessId: string,
  startISO: string,
  endISO: string
): Promise<ReportData> {
  return withBusinessContext(businessId, async (c) => {
    const { rows: [overviewRow] } = await c.query(
      `SELECT
         (SELECT count(*)::int FROM bookings
            WHERE start_time >= $1 AND start_time < $2 AND status = ANY($3::booking_status[])) AS settled_bookings,
         (SELECT coalesce(sum(amount), 0)::int FROM bookings
            WHERE start_time >= $1 AND start_time < $2 AND status = ANY($3::booking_status[])) AS total_revenue,
         (SELECT count(*)::int FROM bookings
            WHERE start_time >= $1 AND start_time < $2 AND status = 'CANCELLED') AS cancelled_count,
         (SELECT count(*)::int FROM bookings
            WHERE start_time >= $1 AND start_time < $2 AND status = 'NO_SHOW') AS no_show_count,
         (SELECT count(*)::int FROM bookings
            WHERE start_time >= $1 AND start_time < $2) AS all_count`,
      [startISO, endISO, SETTLED]
    );

    const settledBookings = overviewRow.settled_bookings;
    const totalRevenue = overviewRow.total_revenue;
    const cancelledCount = overviewRow.cancelled_count;
    const noShowCount = overviewRow.no_show_count;
    const allCount = overviewRow.all_count;

    const overview: ReportOverview = {
      settledBookings,
      totalRevenue,
      avgBookingValue: settledBookings > 0 ? Math.round(totalRevenue / settledBookings) : 0,
      cancelledCount,
      noShowCount,
      cancellationRate: allCount > 0 ? cancelledCount / allCount : 0,
    };

    const { rows: byStaffRows } = await c.query(
      `SELECT st.name,
              count(*) FILTER (WHERE b.status = ANY($3::booking_status[]))::int AS bookings,
              coalesce(sum(b.amount) FILTER (WHERE b.status = ANY($3::booking_status[])), 0)::int AS revenue
       FROM bookings b
       JOIN staff st ON st.id = b.staff_id
       WHERE b.start_time >= $1 AND b.start_time < $2
       GROUP BY st.name
       ORDER BY revenue DESC`,
      [startISO, endISO, SETTLED]
    );

    const { rows: byServiceRows } = await c.query(
      `SELECT s.name,
              count(*) FILTER (WHERE b.status = ANY($3::booking_status[]))::int AS bookings,
              coalesce(sum(b.amount) FILTER (WHERE b.status = ANY($3::booking_status[])), 0)::int AS revenue
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       WHERE b.start_time >= $1 AND b.start_time < $2
       GROUP BY s.name
       ORDER BY revenue DESC`,
      [startISO, endISO, SETTLED]
    );

    return {
      overview,
      byStaff: byStaffRows.map((r) => ({ name: r.name, bookings: r.bookings, revenue: r.revenue })),
      byService: byServiceRows.map((r) => ({ name: r.name, bookings: r.bookings, revenue: r.revenue })),
    };
  });
}

export async function getBookingRowsForExport(
  businessId: string,
  startISO: string,
  endISO: string
) {
  return withBusinessContext(businessId, async (c) => {
    const { rows } = await c.query(
      `SELECT b.start_time, b.status, b.amount, s.name AS service_name, st.name AS staff_name,
              cu.name AS customer_name, cu.phone AS customer_phone, cu.email AS customer_email
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN staff st ON st.id = b.staff_id
       LEFT JOIN customers cu ON cu.id = b.customer_id
       WHERE b.start_time >= $1 AND b.start_time < $2
       ORDER BY b.start_time ASC`,
      [startISO, endISO]
    );
    return rows;
  });
}

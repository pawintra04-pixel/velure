import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import {
  getStatTiles,
  getMonthlyRevenue,
  getUpcomingBookings,
  getBookingStatusBreakdown,
} from "@/lib/dashboard-data";
import { formatBaht } from "@/lib/money";
import { StatCard } from "@/components/dashboard/StatCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { UpcomingBookings } from "@/components/dashboard/UpcomingBookings";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { BookingStatusDonut } from "@/components/dashboard/BookingStatusDonut";

function greeting(): string {
  const hour = new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok", hour: "numeric", hour12: false });
  const h = parseInt(hour, 10);
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const owner = await requireOwner();
  const businessId = owner.businessId;

  const [business, stats, revenue, upcoming, statusBreakdown] = await Promise.all([
    withBusinessContext(businessId, async (c) => {
      const { rows: [row] } = await c.query(`SELECT name, slug FROM businesses WHERE id = $1`, [
        businessId,
      ]);
      return row;
    }),
    getStatTiles(businessId),
    getMonthlyRevenue(businessId),
    getUpcomingBookings(businessId),
    getBookingStatusBreakdown(businessId),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold">{greeting()}</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Here&apos;s how {business.name} is doing today ·{" "}
        <a href={`/book/${business.slug}`} target="_blank" className="text-accent underline">
          View your booking page
        </a>
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Today's bookings" value={String(stats.todayBookings)} tone="green" />
        <StatCard
          label="Revenue this month"
          value={formatBaht(stats.monthRevenueSatang)}
          tone="blue"
        />
        <StatCard
          label="Pending payment"
          value={String(stats.pendingPayment)}
          hint="Not yet confirmed"
          tone="amber"
        />
        <StatCard label="Total customers" value={String(stats.totalCustomers)} tone="pink" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart data={revenue} />
        </div>
        <div className="flex flex-col gap-4">
          <BookingStatusDonut data={statusBreakdown} />
          <UpcomingBookings bookings={upcoming} />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}

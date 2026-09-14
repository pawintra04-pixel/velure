import { getDemoBusinessId } from "@/lib/demo-business";
import {
  getStatTiles,
  getMonthlyRevenue,
  getUpcomingBookings,
} from "@/lib/dashboard-data";
import { formatBaht } from "@/lib/money";
import { TopNav } from "@/components/dashboard/TopNav";
import { StatCard } from "@/components/dashboard/StatCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { UpcomingBookings } from "@/components/dashboard/UpcomingBookings";
import { QuickActions } from "@/components/dashboard/QuickActions";

function greeting(): string {
  const hour = new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok", hour: "numeric", hour12: false });
  const h = parseInt(hour, 10);
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  // STUB: real auth doesn't exist yet, so this reads the seeded demo
  // business instead of the signed-in owner's. See src/lib/demo-business.ts.
  const businessId = await getDemoBusinessId();

  const [stats, revenue, upcoming] = await Promise.all([
    getStatTiles(businessId),
    getMonthlyRevenue(businessId),
    getUpcomingBookings(businessId),
  ]);

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-semibold">{greeting()}</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Here&apos;s how your shop is doing today
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Today's bookings" value={String(stats.todayBookings)} />
          <StatCard
            label="Revenue this month"
            value={formatBaht(stats.monthRevenueSatang)}
          />
          <StatCard
            label="Pending payment"
            value={String(stats.pendingPayment)}
            hint="Not yet confirmed"
          />
          <StatCard label="Total customers" value={String(stats.totalCustomers)} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RevenueChart data={revenue} />
          </div>
          <div className="flex flex-col gap-4">
            <UpcomingBookings bookings={upcoming} />
            <QuickActions />
          </div>
        </div>
      </main>
    </div>
  );
}

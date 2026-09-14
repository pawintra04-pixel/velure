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
        <h1 className="text-2xl font-semibold">สวัสดีตอนเช้า 👋</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          ภาพรวมร้านของคุณวันนี้
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="นัดหมายวันนี้" value={String(stats.todayBookings)} />
          <StatCard
            label="รายได้เดือนนี้"
            value={formatBaht(stats.monthRevenueSatang)}
          />
          <StatCard
            label="รอชำระเงิน"
            value={String(stats.pendingPayment)}
            hint="นัดที่ยังไม่ยืนยัน"
          />
          <StatCard label="ลูกค้าทั้งหมด" value={String(stats.totalCustomers)} />
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

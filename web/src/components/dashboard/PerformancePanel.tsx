import { formatBaht } from "@/lib/money";
import type { MonthlyRevenuePoint, StatTiles } from "@/lib/dashboard-data";
import { overview, type Locale } from "@/lib/i18n";

// Reuses the exact same year-to-date-by-month series the old bar chart used
// (getMonthlyRevenue) as a sparkline instead of inventing daily-granularity
// revenue data that doesn't exist yet — real trend, just fewer points early
// in the year.
function sparklinePoints(data: MonthlyRevenuePoint[], width: number, height: number): string {
  if (data.length === 0) return "";
  const max = Math.max(1, ...data.map((d) => d.totalSatang));
  const step = data.length > 1 ? width / (data.length - 1) : 0;
  return data
    .map((d, i) => {
      const x = data.length > 1 ? i * step : width / 2;
      const y = height - (d.totalSatang / max) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

// Omitted (not zeroed) when there's no real previous month to compare
// against — a fabricated "+0%" would be worse than no badge at all.
function monthOverMonthTrend(data: MonthlyRevenuePoint[]): number | null {
  if (data.length < 2) return null;
  const prev = data[data.length - 2].totalSatang;
  const current = data[data.length - 1].totalSatang;
  if (prev <= 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

export function PerformancePanel({
  stats,
  monthlyRevenue,
  locale,
}: {
  stats: StatTiles;
  monthlyRevenue: MonthlyRevenuePoint[];
  locale: Locale;
}) {
  const trend = monthOverMonthTrend(monthlyRevenue);
  const points = sparklinePoints(monthlyRevenue, 340, 34);
  const t = overview[locale];

  return (
    <div>
      <div className="text-[13.5px] font-semibold uppercase tracking-wide text-ink">{t.performance}</div>

      <div className="mt-4 border-t border-border pt-5">
        <div className="text-[13px] text-ink-muted">{t.revenueThisMonth}</div>
        <div className="mt-1.5 flex items-baseline gap-3">
          <span className="font-mono text-[28px] font-semibold tracking-tight text-ink">
            {formatBaht(stats.monthRevenueSatang)}
          </span>
          {trend !== null && (
            <span className={`text-[13px] font-semibold ${trend >= 0 ? "text-[#1b8a5a]" : "text-[#d03b3b]"}`}>
              {trend >= 0 ? "+" : ""}
              {trend}%
            </span>
          )}
        </div>
        {monthlyRevenue.length > 1 && (
          <svg width="100%" height="36" viewBox="0 0 340 36" className="mt-3">
            <polyline
              points={points}
              fill="none"
              stroke="var(--sunburst)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      <div className="mt-5 flex border-t border-border pt-5">
        <div className="flex-1">
          <div className="text-[12.5px] text-ink-muted">{t.bookingsToday}</div>
          <div className="mt-1 font-mono text-[19px] font-semibold text-ink">{stats.todayBookings}</div>
        </div>
        <div className="flex-1 border-l border-border pl-4">
          <div className="text-[12.5px] text-ink-muted">{t.totalCustomers}</div>
          <div className="mt-1 font-mono text-[19px] font-semibold text-ink">{stats.totalCustomers}</div>
        </div>
      </div>
    </div>
  );
}

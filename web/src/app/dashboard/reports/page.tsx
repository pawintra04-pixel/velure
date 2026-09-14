import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { getReportData, resolveReportRange, type ReportRangeKey } from "@/lib/reports-data";
import { todayISOInBangkok } from "@/lib/bookings-data";
import { formatBaht } from "@/lib/money";
import { TopNav } from "@/components/dashboard/TopNav";
import { StatCard } from "@/components/dashboard/StatCard";
import { PrintButton } from "./PrintButton";

const RANGES: { key: ReportRangeKey; label: string }[] = [
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const owner = await requireOwner();
  const { range: rangeParam } = await searchParams;
  const rangeKey: ReportRangeKey = RANGES.some((r) => r.key === rangeParam)
    ? (rangeParam as ReportRangeKey)
    : "month";

  const { startISO, endISO, label } = resolveReportRange(rangeKey, todayISOInBangkok());
  const report = await getReportData(owner.businessId, startISO, endISO);

  return (
    <div className="min-h-screen">
      <TopNav ownerEmail={owner.email} />
      <main className="mx-auto max-w-4xl px-6 py-8 print:max-w-none">
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-2xl font-semibold">Reports</h1>
            <p className="mt-1 text-sm text-ink-secondary">Revenue and bookings, {label.toLowerCase()}.</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/reports/export?range=${rangeKey}`}
              className="rounded-full border border-border px-4 py-1.5 text-sm text-ink-secondary hover:bg-page"
            >
              Export CSV
            </a>
            <PrintButton />
          </div>
        </div>

        <h1 className="hidden text-2xl font-semibold print:block">Velure — {label}</h1>

        <div className="mt-4 flex gap-1 print:hidden">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/dashboard/reports?range=${r.key}`}
              className={`rounded-full px-4 py-1.5 text-sm ${
                rangeKey === r.key ? "bg-ink text-white" : "border border-border text-ink-secondary hover:bg-page"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Settled bookings" value={String(report.overview.settledBookings)} />
          <StatCard label="Revenue" value={formatBaht(report.overview.totalRevenue)} />
          <StatCard label="Avg. booking value" value={formatBaht(report.overview.avgBookingValue)} />
          <StatCard
            label="Cancellation rate"
            value={`${Math.round(report.overview.cancellationRate * 100)}%`}
            hint={`${report.overview.cancelledCount} cancelled · ${report.overview.noShowCount} no-show`}
          />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <BreakdownTable title="By team member" rows={report.byStaff} />
          <BreakdownTable title="By service" rows={report.byService} />
        </div>
      </main>
    </div>
  );
}

function BreakdownTable({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; bookings: number; revenue: number }[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 print:border-black">
      <div className="text-sm font-medium text-ink-secondary">{title}</div>
      {rows.length === 0 ? (
        <div className="mt-3 text-sm text-ink-muted">No data for this range.</div>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-muted">
              <th className="pb-2 font-normal">Name</th>
              <th className="pb-2 font-normal">Bookings</th>
              <th className="pb-2 text-right font-normal">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-border">
                <td className="py-2">{r.name}</td>
                <td className="py-2">{r.bookings}</td>
                <td className="py-2 text-right">{formatBaht(r.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

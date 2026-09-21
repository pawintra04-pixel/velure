import { requireOwner } from "@/lib/auth";
import { getReportData, resolveReportRange, type ReportRangeKey } from "@/lib/reports-data";
import { todayISOInBangkok } from "@/lib/bookings-data";
import { formatBaht } from "@/lib/money";
import { RangeTabs } from "./RangeTabs";
import { PrintButton } from "./PrintButton";
import { PageShell, PageHeader } from "@/components/dashboard/PageShell";

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
    <PageShell width="wide" className="print:max-w-none">
      <div className="border-b border-border pb-5 print:hidden">
        <PageHeader
          title="Reports"
          description={`Revenue and bookings, ${label.toLowerCase()}.`}
          actions={
            <>
              <RangeTabs ranges={RANGES} active={rangeKey} />
              <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
              <a
                href={`/api/reports/export?range=${rangeKey}`}
                className="rounded-full border border-border px-4 py-1.5 text-sm text-ink-secondary hover:bg-page"
              >
                Export CSV
              </a>
              <PrintButton />
            </>
          }
        />
      </div>

      <h1 className="hidden text-2xl font-semibold print:block">Velure — {label}</h1>

      {/* Metrics read as one compact information strip — 2x2 on mobile,
          a single prominent row on desktop — not four separate dashboard
          cards. */}
      <div className="mt-8 grid grid-cols-2 divide-x divide-y divide-border rounded-2xl border border-border sm:grid-cols-4 sm:divide-y-0">
        <Metric label="Settled bookings" value={String(report.overview.settledBookings)} />
        <Metric label="Revenue" value={formatBaht(report.overview.totalRevenue)} />
        <Metric label="Avg. booking value" value={formatBaht(report.overview.avgBookingValue)} />
        <Metric
          label="Cancellation rate"
          value={`${Math.round(report.overview.cancellationRate * 100)}%`}
          hint={`${report.overview.cancelledCount} cancelled · ${report.overview.noShowCount} no-show`}
        />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <BreakdownTable title="By team member" rows={report.byStaff} />
        <BreakdownTable title="By service" rows={report.byService} />
      </div>
    </PageShell>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="p-5 sm:p-6">
      <div className="text-[12px] uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="mt-2 font-mono text-[26px] font-semibold text-ink sm:text-[30px]">{value}</div>
      {hint && <div className="mt-1 truncate text-[12px] text-ink-muted">{hint}</div>}
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
    <div className="rounded-2xl border border-border p-5 sm:p-6 print:border-black">
      <div className="text-[13px] font-semibold uppercase tracking-wide text-ink">{title}</div>
      {rows.length === 0 ? (
        <div className="mt-3 text-sm text-ink-muted">No data for this range.</div>
      ) : (
        <>
          <table className="mt-3 hidden w-full text-sm sm:table">
            <thead>
              <tr className="border-b border-border text-left text-xs text-ink-muted">
                <th className="pb-2 font-normal">Name</th>
                <th className="pb-2 font-normal">Bookings</th>
                <th className="pb-2 text-right font-normal">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.name}>
                  <td className="py-2 pr-2">{r.name}</td>
                  <td className="py-2">{r.bookings}</td>
                  <td className="py-2 text-right font-mono">{formatBaht(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 divide-y divide-border sm:hidden">
            {rows.map((r) => (
              <div key={r.name} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-ink">{r.name}</div>
                  <div className="text-xs text-ink-muted">{r.bookings} bookings</div>
                </div>
                <div className="shrink-0 font-mono text-sm text-ink">{formatBaht(r.revenue)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

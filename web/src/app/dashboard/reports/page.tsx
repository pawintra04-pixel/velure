import { requireOwner } from "@/lib/auth";
import { getReportData, resolveReportRange, type ReportRangeKey } from "@/lib/reports-data";
import { todayISOInBangkok } from "@/lib/bookings-data";
import { formatBaht } from "@/lib/money";
import { RangeTabs } from "./RangeTabs";
import { PrintButton } from "./PrintButton";
import { PageShell, PageHeader } from "@/components/dashboard/PageShell";
import { reportsText, tRevenueBookingsDesc, tCancelledNoShow, type Locale } from "@/lib/i18n";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const owner = await requireOwner();
  const locale = owner.locale;
  const t = reportsText[locale];
  const RANGES: { key: ReportRangeKey; label: string }[] = [
    { key: "week", label: t.thisWeek },
    { key: "month", label: t.thisMonth },
    { key: "year", label: t.thisYear },
    { key: "all", label: t.allTime },
  ];
  const { range: rangeParam } = await searchParams;
  const rangeKey: ReportRangeKey = RANGES.some((r) => r.key === rangeParam)
    ? (rangeParam as ReportRangeKey)
    : "month";

  const { startISO, endISO } = resolveReportRange(rangeKey, todayISOInBangkok());
  const label = RANGES.find((r) => r.key === rangeKey)!.label;
  const report = await getReportData(owner.businessId, startISO, endISO);

  return (
    <PageShell width="wide" className="print:max-w-none">
      <div className="border-b border-border pb-5 print:hidden">
        <PageHeader
          title={t.title}
          description={tRevenueBookingsDesc(locale, label)}
          actions={
            <>
              <RangeTabs ranges={RANGES} active={rangeKey} />
              <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
              <a
                href={`/api/reports/export?range=${rangeKey}`}
                className="rounded-full border border-border px-4 py-1.5 text-sm text-ink-secondary hover:bg-page"
              >
                {t.exportCsv}
              </a>
              <PrintButton locale={locale} />
            </>
          }
        />
      </div>

      <h1 className="hidden text-2xl font-semibold print:block">Velure — {label}</h1>

      {/* Metrics read as one compact information strip — 2x2 on mobile,
          a single prominent row on desktop — not four separate dashboard
          cards. */}
      <div className="mt-8 grid grid-cols-2 divide-x divide-y divide-border rounded-2xl border border-border sm:grid-cols-4 sm:divide-y-0">
        <Metric label={t.settledBookings} value={String(report.overview.settledBookings)} />
        <Metric label={t.revenue} value={formatBaht(report.overview.totalRevenue)} />
        <Metric label={t.avgBookingValue} value={formatBaht(report.overview.avgBookingValue)} />
        <Metric
          label={t.cancellationRate}
          value={`${Math.round(report.overview.cancellationRate * 100)}%`}
          hint={tCancelledNoShow(locale, report.overview.cancelledCount, report.overview.noShowCount)}
        />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <BreakdownTable title={t.byTeamMember} rows={report.byStaff} locale={locale} />
        <BreakdownTable title={t.byService} rows={report.byService} locale={locale} />
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
  locale,
}: {
  title: string;
  rows: { name: string; bookings: number; revenue: number }[];
  locale: Locale;
}) {
  const t = reportsText[locale];
  return (
    <div className="rounded-2xl border border-border p-5 sm:p-6 print:border-black">
      <div className="text-[13px] font-semibold uppercase tracking-wide text-ink">{title}</div>
      {rows.length === 0 ? (
        <div className="mt-3 text-sm text-ink-muted">{t.noDataForRange}</div>
      ) : (
        <>
          <table className="mt-3 hidden w-full text-sm sm:table">
            <thead>
              <tr className="border-b border-border text-left text-xs text-ink-muted">
                <th className="pb-2 font-normal">{t.name}</th>
                <th className="pb-2 font-normal">{t.bookings}</th>
                <th className="pb-2 text-right font-normal">{t.revenue}</th>
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
                  <div className="text-xs text-ink-muted">{r.bookings} {t.bookingsUnit}</div>
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

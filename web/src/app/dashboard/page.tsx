import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import {
  getStatTiles,
  getMonthlyRevenue,
  getTodaySchedule,
  getAttentionItems,
} from "@/lib/dashboard-data";
import { TodaySchedule, UpNextLine } from "@/components/dashboard/TodaySchedule";
import { NeedsAttention } from "@/components/dashboard/NeedsAttention";
import { PerformancePanel } from "@/components/dashboard/PerformancePanel";
import { NewBookingForm } from "@/app/dashboard/bookings/NewBookingForm";
import { overview, tTodayLabel, tTodayAt, type Locale } from "@/lib/i18n";

// Visually matches "+ New booking" but has no real capability behind it
// yet (no distinct quick-add flow exists in the app) — rendered inert
// rather than duplicating New booking's action or fabricating a new one.
// See the Phase 1 implementation report for the flag on this element.
function QuickAddButton({ className, locale }: { className: string; locale: Locale }) {
  return (
    <button type="button" disabled aria-disabled="true" title="Quick add isn't available yet" className={className}>
      {overview[locale].quickAdd}
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="ml-1.5 inline-block">
        <path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export default async function DashboardPage() {
  const owner = await requireOwner();
  const businessId = owner.businessId;

  const [business, stats, monthlyRevenue, schedule, attention, { services, staff }] = await Promise.all([
    withBusinessContext(businessId, async (c) => {
      const { rows: [row] } = await c.query(`SELECT name, slug FROM businesses WHERE id = $1`, [
        businessId,
      ]);
      return row;
    }),
    getStatTiles(businessId),
    getMonthlyRevenue(businessId),
    getTodaySchedule(businessId),
    getAttentionItems(businessId),
    withBusinessContext(businessId, async (c) => {
      const servicesResult = await c.query(`SELECT id, name FROM services ORDER BY name`);
      const staffResult = await c.query(`SELECT id, name FROM staff ORDER BY name`);
      return { services: servicesResult.rows, staff: staffResult.rows };
    }),
  ]);

  const locale = owner.locale;

  return (
    <div className="font-didact mx-auto max-w-[1320px] px-6 py-8 sm:px-10 sm:py-10 lg:px-12">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div>
          <div className="text-[13px] text-ink-muted">{tTodayLabel(locale, new Date())}</div>
          <h1 className="mt-1.5 text-[26px] font-normal tracking-tight text-ink sm:text-[32px] lg:text-[36px]">
            {tTodayAt(locale, business.name)}
          </h1>
        </div>

        {/* Desktop actions */}
        <div className="hidden items-center gap-3 sm:flex">
          <QuickAddButton
            locale={locale}
            className="flex items-center rounded-lg border border-ink/25 px-4 py-2.5 text-[14.5px] text-ink-secondary opacity-60 cursor-not-allowed"
          />
          <NewBookingForm
            services={services}
            staff={staff}
            buttonClassName="rounded-lg bg-sunburst px-5 py-2.5 text-[15px] font-medium text-ink transition-[filter] hover:brightness-95"
          />
        </div>

        {/* Mobile actions — primary CTA first, Quick add de-emphasized below it */}
        <div className="flex flex-col gap-2 sm:hidden">
          <NewBookingForm
            services={services}
            staff={staff}
            buttonClassName="w-full rounded-lg bg-sunburst px-4 py-3.5 text-center text-[15px] font-medium text-ink"
          />
          <QuickAddButton
            locale={locale}
            className="flex items-center justify-center py-1 text-[13px] text-ink-muted opacity-70 cursor-not-allowed"
          />
        </div>
      </div>

      <div className="mt-7">
        <UpNextLine entries={schedule} locale={locale} />
      </div>

      {/*
        Mobile order (locked): Needs Attention -> Today's Schedule -> Performance.
        Desktop: Schedule occupies column 1 across both rows; Needs Attention
        and Performance stack in column 2. `order` drives mobile stacking
        (single column, so `order` alone determines vertical sequence);
        `lg:order-none` hands placement back to the explicit column/row
        lines below at desktop width.
      */}
      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.75fr)_minmax(300px,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-10">
        <div className="order-2 lg:order-none lg:col-start-1 lg:row-start-1 lg:row-span-2">
          <TodaySchedule entries={schedule} locale={locale} />
        </div>
        <div className="order-1 lg:order-none lg:col-start-2 lg:row-start-1">
          <NeedsAttention data={attention} locale={locale} />
        </div>
        <div className="order-3 lg:order-none lg:col-start-2 lg:row-start-2">
          <PerformancePanel stats={stats} monthlyRevenue={monthlyRevenue} locale={locale} />
        </div>
      </div>
    </div>
  );
}

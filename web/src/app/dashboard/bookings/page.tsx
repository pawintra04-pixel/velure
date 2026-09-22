import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import {
  getBookingsInRange,
  bangkokMidnight,
  todayISOInBangkok,
  addDays,
  startOfWeek,
  startOfMonth,
} from "@/lib/bookings-data";
import { ViewTabs } from "./ViewTabs";
import { BookingRow, BookingList } from "./BookingRow";
import { DayView } from "./DayView";
import { WeekView } from "./WeekView";
import { MonthView } from "./MonthView";
import { NewBookingForm } from "./NewBookingForm";
import { CategoryTabs } from "./CategoryTabs";
import { PageShell, PageHeader } from "@/components/dashboard/PageShell";
import { bookingsText, type Locale } from "@/lib/i18n";

function toISO(d: Date): string {
  return d.toISOString();
}

function statusFilterLabelKey(status: string): string {
  const map: Record<string, string> = {
    "CONFIRMED,COMPLETED": "filterConfirmed",
    "TEMPORARY_HOLD,PAYMENT_PENDING": "filterUnpaid",
    "CANCELLED,NO_SHOW,PAYMENT_FAILED,EXPIRED": "filterCancelledNoShow",
    CONFIRMED: "filterPaid",
    COMPLETED: "filterCompleted",
    "CANCELLED,NO_SHOW,PAYMENT_FAILED,EXPIRED,REFUNDED,PARTIALLY_REFUNDED": "filterCancelled",
  };
  return map[status] ?? "";
}

// The default "All" list — everything still worth acting on. Cancelled/
// no-show/failed/refunded bookings pile up over a business's lifetime and
// don't need attention, so they're excluded here and live behind their own
// "Cancelled" pill in CategoryTabs instead of bloating the default view.
const ACTIVE_STATUSES = ["TEMPORARY_HOLD", "PAYMENT_PENDING", "CONFIRMED", "COMPLETED"];

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; status?: string }>;
}) {
  const owner = await requireOwner();
  const locale = owner.locale;
  const t = bookingsText[locale];
  const { view = "list", date = todayISOInBangkok(), status } = await searchParams;
  const statusFilter = status ? status.split(",") : null;

  const { services, staff } = await withBusinessContext(owner.businessId, async (c) => {
    const servicesResult = await c.query(`SELECT id, name FROM services ORDER BY name`);
    const staffResult = await c.query(`SELECT id, name FROM staff ORDER BY name`);
    return { services: servicesResult.rows, staff: staffResult.rows };
  });

  const filterLabelKey = status ? statusFilterLabelKey(status) : "";
  const filterLabel = filterLabelKey ? t[filterLabelKey] : status;

  return (
    <PageShell width="standard">
        <div className="border-b border-border pb-5">
          <PageHeader
            title={t.title}
            description={t.description}
            actions={
              <>
                <ViewTabs active={view} date={date} locale={locale} />
                <NewBookingForm
                  services={services}
                  staff={staff}
                  locale={locale}
                  buttonClassName="rounded-lg bg-sunburst px-4 py-2 text-sm font-medium text-ink transition-[filter] hover:brightness-95"
                />
              </>
            }
          />

          {view === "list" && (
            <div className="mt-5">
              <CategoryTabs activeStatus={status ?? null} locale={locale} />
            </div>
          )}

          {statusFilter && (
            <div className="mt-4 flex items-center gap-2 text-sm text-ink-secondary">
              {t.showing} <span className="text-ink">{filterLabel}</span>
              <Link href="/dashboard/bookings" className="text-ink underline">
                {t.clear}
              </Link>
            </div>
          )}
        </div>

        <div className="mt-6">
          {view === "day" && (
            <DayView
              date={date}
              locale={locale}
              bookings={await getBookingsInRange(
                owner.businessId,
                toISO(bangkokMidnight(date)),
                toISO(bangkokMidnight(addDays(date, 1)))
              )}
            />
          )}
          {view === "week" && (
            <WeekView
              weekStart={startOfWeek(date)}
              locale={locale}
              bookings={await getBookingsInRange(
                owner.businessId,
                toISO(bangkokMidnight(startOfWeek(date))),
                toISO(bangkokMidnight(addDays(startOfWeek(date), 7)))
              )}
            />
          )}
          {view === "month" && (
            <MonthView
              monthStart={startOfMonth(date)}
              locale={locale}
              bookings={await getBookingsInRange(
                owner.businessId,
                toISO(bangkokMidnight(startOfWeek(startOfMonth(date)))),
                // Exactly the 42-day grid MonthView itself renders — fetching
                // a mismatched range would silently blank out real bookings
                // on the leading/trailing days from adjacent months.
                toISO(bangkokMidnight(addDays(startOfWeek(startOfMonth(date)), 42)))
              )}
            />
          )}
          {view === "list" && (
            <ListView
              businessId={owner.businessId}
              today={todayISOInBangkok()}
              statusFilter={statusFilter}
              locale={locale}
            />
          )}
        </div>
    </PageShell>
  );
}

async function ListView({
  businessId,
  today,
  statusFilter,
  locale,
}: {
  businessId: string;
  today: string;
  statusFilter: string[] | null;
  locale: Locale;
}) {
  const t = bookingsText[locale];
  // The plain list only looks 1 day back by design (recent + upcoming, not
  // a full history dump) — but a status filter arriving from the Overview
  // donut ("Cancelled/no-show this month") needs to reach back far enough
  // to actually contain everything that count was counting, or a filtered
  // click-through can show fewer rows than the number that sent you here.
  const allBookings = await getBookingsInRange(
    businessId,
    toISO(bangkokMidnight(addDays(today, statusFilter ? -90 : -1))),
    toISO(bangkokMidnight(addDays(today, 365)))
  );
  const bookings = statusFilter
    ? allBookings.filter((b) => statusFilter.includes(b.status))
    : allBookings.filter((b) => ACTIVE_STATUSES.includes(b.status));

  if (bookings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
        {statusFilter ? t.noBookingsFilter : t.noBookingsYet}
      </div>
    );
  }

  return (
    <BookingList>
      {bookings.map((b) => (
        <BookingRow key={b.id} b={b} locale={locale} />
      ))}
    </BookingList>
  );
}

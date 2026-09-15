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
import { BookingRow } from "./BookingRow";
import { DayView } from "./DayView";
import { WeekView } from "./WeekView";
import { MonthView } from "./MonthView";
import { NewBookingForm } from "./NewBookingForm";

function toISO(d: Date): string {
  return d.toISOString();
}

const STATUS_FILTER_LABELS: Record<string, string> = {
  "CONFIRMED,COMPLETED": "Confirmed",
  "TEMPORARY_HOLD,PAYMENT_PENDING": "Pending",
  "CANCELLED,NO_SHOW,PAYMENT_FAILED,EXPIRED": "Cancelled/no-show",
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; status?: string }>;
}) {
  const owner = await requireOwner();
  const { view = "list", date = todayISOInBangkok(), status } = await searchParams;
  const statusFilter = status ? status.split(",") : null;

  const { services, staff } = await withBusinessContext(owner.businessId, async (c) => {
    const servicesResult = await c.query(`SELECT id, name FROM services ORDER BY name`);
    const staffResult = await c.query(`SELECT id, name FROM staff ORDER BY name`);
    return { services: servicesResult.rows, staff: staffResult.rows };
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Bookings</h1>
            <p className="mt-1 text-sm text-ink-secondary">
              Manage appointments across list, day, week, and month views.
            </p>
          </div>
          <ViewTabs active={view} date={date} />
        </div>

        <div className="mt-4">
          <NewBookingForm services={services} staff={staff} />
        </div>

        {statusFilter && (
          <div className="mt-4 flex items-center gap-2 text-sm text-ink-secondary">
            Showing: <span className="font-medium text-ink">{STATUS_FILTER_LABELS[status!] ?? status}</span>
            <Link href="/dashboard/bookings" className="text-accent underline">
              Clear
            </Link>
          </div>
        )}

        <div className="mt-6">
          {view === "day" && (
            <DayView
              date={date}
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
            />
          )}
        </div>
    </div>
  );
}

async function ListView({
  businessId,
  today,
  statusFilter,
}: {
  businessId: string;
  today: string;
  statusFilter: string[] | null;
}) {
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
  const bookings = statusFilter ? allBookings.filter((b) => statusFilter.includes(b.status)) : allBookings;

  return (
    <div className="flex flex-col gap-3">
      {bookings.length === 0 && (
        <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-ink-muted">
          {statusFilter ? "No bookings match this filter." : "No bookings yet."}
        </div>
      )}
      {bookings.map((b) => (
        <BookingRow key={b.id} b={b} />
      ))}
    </div>
  );
}

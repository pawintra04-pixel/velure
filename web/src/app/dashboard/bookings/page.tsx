import { requireOwner } from "@/lib/auth";
import {
  getBookingsInRange,
  bangkokMidnight,
  todayISOInBangkok,
  addDays,
  startOfWeek,
  startOfMonth,
} from "@/lib/bookings-data";
import { TopNav } from "@/components/dashboard/TopNav";
import { ViewTabs } from "./ViewTabs";
import { BookingRow } from "./BookingRow";
import { DayView } from "./DayView";
import { WeekView } from "./WeekView";
import { MonthView } from "./MonthView";

function toISO(d: Date): string {
  return d.toISOString();
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const owner = await requireOwner();
  const { view = "list", date = todayISOInBangkok() } = await searchParams;

  return (
    <div className="min-h-screen">
      <TopNav ownerEmail={owner.email} />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Bookings</h1>
            <p className="mt-1 text-sm text-ink-secondary">
              Manage appointments across list, day, week, and month views.
            </p>
          </div>
          <ViewTabs active={view} date={date} />
        </div>

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
            <ListView businessId={owner.businessId} today={todayISOInBangkok()} />
          )}
        </div>
      </main>
    </div>
  );
}

async function ListView({ businessId, today }: { businessId: string; today: string }) {
  const bookings = await getBookingsInRange(
    businessId,
    toISO(bangkokMidnight(addDays(today, -1))),
    toISO(bangkokMidnight(addDays(today, 365)))
  );

  return (
    <div className="flex flex-col gap-3">
      {bookings.length === 0 && (
        <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-ink-muted">
          No bookings yet.
        </div>
      )}
      {bookings.map((b) => (
        <BookingRow key={b.id} b={b} />
      ))}
    </div>
  );
}

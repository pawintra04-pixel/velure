import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import {
  getBookingsInRange,
  getClassSessionsInRange,
  getStaffBlocksInRange,
  bangkokMidnight,
  todayISOInBangkok,
  addDays,
  startOfWeek,
  startOfMonth,
} from "@/lib/bookings-data";
import { NewBookingForm } from "../bookings/NewBookingForm";
import { WeekView } from "../bookings/WeekView";
import { MonthView } from "../bookings/MonthView";
import { CalendarGrid, type BusinessHoursRow, type StaffHoursRow } from "./CalendarGrid";
import { CalendarViewTabs } from "./CalendarViewTabs";
import { DayDetailList } from "./DayDetailList";
import { RemindersBanner } from "./RemindersBanner";
import { PageShell, PageHeader } from "@/components/dashboard/PageShell";

function toISO(d: Date): string {
  return d.toISOString();
}

// Postgres EXTRACT(DOW)/JS getUTCDay both use 0=Sunday..6=Saturday — same
// technique availability.ts uses to read a date-only string's weekday.
function dayOfWeek(dateISO: string): number {
  return new Date(`${dateISO}T00:00:00Z`).getUTCDay();
}

// A class session's own bookings all share one time slot by design (see
// db/migrations/013_class_sessions.sql) — rendered as one block per session
// via getClassSessionsInRange instead, so per-attendee rows are excluded
// from the grid here to avoid stacking N identical-looking blocks on top of
// each other. The detail list below still shows every attendee individually.
const HIDDEN_STATUSES = ["CANCELLED", "EXPIRED", "PAYMENT_FAILED"];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const owner = await requireOwner();
  const { view = "day", date = todayISOInBangkok() } = await searchParams;

  const { staff, services } = await withBusinessContext(owner.businessId, async (c) => {
    const staffResult = await c.query<{ id: string; name: string }>(
      `SELECT id, name FROM staff ORDER BY name`
    );
    const servicesResult = await c.query<{ id: string; name: string }>(
      `SELECT id, name FROM services ORDER BY name`
    );
    return { staff: staffResult.rows, services: servicesResult.rows };
  });

  return (
    <PageShell width="wide">
      <div className="border-b border-border pb-5">
        <PageHeader
          title="Calendar"
          description="Your team's day, week, and month, side by side."
          actions={
            <>
              <CalendarViewTabs active={view} date={date} />
              <NewBookingForm
                services={services}
                staff={staff}
                buttonClassName="rounded-lg bg-sunburst px-4 py-2 text-sm font-medium text-ink transition-[filter] hover:brightness-95"
              />
            </>
          }
        />
      </div>

      <div className="mt-6">
        {view === "week" && (
          <WeekView
            weekStart={startOfWeek(date)}
            basePath="/dashboard/calendar"
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
            basePath="/dashboard/calendar"
            bookings={await getBookingsInRange(
              owner.businessId,
              toISO(bangkokMidnight(startOfWeek(startOfMonth(date)))),
              toISO(bangkokMidnight(addDays(startOfWeek(startOfMonth(date)), 42)))
            )}
          />
        )}
        {view === "day" && <DayView businessId={owner.businessId} date={date} staff={staff} />}
      </div>
    </PageShell>
  );
}

async function DayView({
  businessId,
  date,
  staff,
}: {
  businessId: string;
  date: string;
  staff: { id: string; name: string }[];
}) {
  const dow = dayOfWeek(date);
  const dayStart = toISO(bangkokMidnight(date));
  const dayEnd = toISO(bangkokMidnight(addDays(date, 1)));

  const { businessHours, staffHoursByStaff } = await withBusinessContext(businessId, async (c) => {
    const { rows: [hours] } = await c.query<BusinessHoursRow>(
      `SELECT is_closed, open_time, close_time FROM business_hours
       WHERE business_id = $1 AND day_of_week = $2`,
      [businessId, dow]
    );
    const staffHoursResult = await c.query<StaffHoursRow>(
      `SELECT staff_id, is_off, start_time, end_time, break_start, break_end
       FROM staff_hours WHERE business_id = $1 AND day_of_week = $2`,
      [businessId, dow]
    );
    return {
      businessHours: hours ?? null,
      staffHoursByStaff: new Map(staffHoursResult.rows.map((r) => [r.staff_id, r])),
    };
  });

  const [bookings, classSessions, blocks] = await Promise.all([
    getBookingsInRange(businessId, dayStart, dayEnd),
    getClassSessionsInRange(businessId, dayStart, dayEnd),
    getStaffBlocksInRange(businessId, dayStart, dayEnd),
  ]);
  const visibleBookings = bookings.filter(
    (b) => !b.classSessionId && !HIDDEN_STATUSES.includes(b.status)
  );

  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00+07:00`));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">{label}</h2>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/calendar?date=${todayISOInBangkok()}`}
            className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-page"
          >
            Today
          </Link>
          <Link
            href={`/dashboard/calendar?date=${addDays(date, -1)}`}
            className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-page"
          >
            ← Prev
          </Link>
          <Link
            href={`/dashboard/calendar?date=${addDays(date, 1)}`}
            className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-page"
          >
            Next →
          </Link>
        </div>
      </div>

      <div className="mt-4">
        <RemindersBanner bookings={bookings} classSessions={classSessions} />

        <CalendarGrid
          dateISO={date}
          staff={staff}
          businessHours={businessHours}
          staffHoursByStaff={staffHoursByStaff}
          bookings={visibleBookings}
          allBookings={bookings}
          classSessions={classSessions}
          blocks={blocks}
        />

        <DayDetailList bookings={bookings} classSessions={classSessions} />
      </div>
    </>
  );
}

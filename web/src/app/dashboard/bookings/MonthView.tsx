import Link from "next/link";
import type { CalendarBooking } from "@/lib/bookings-data";
import { addDays, addMonths, startOfWeek } from "@/lib/bookings-data";
import { formatTimeOnly } from "./BookingRow";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE_PER_DAY = 3;

function dateKeyInBangkok(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(iso));
}

export function MonthView({
  monthStart,
  bookings,
}: {
  monthStart: string; // "YYYY-MM-01"
  bookings: CalendarBooking[];
}) {
  const byDay = new Map<string, CalendarBooking[]>();
  for (const b of bookings) {
    const key = dateKeyInBangkok(b.startTime);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(b);
  }

  const gridStart = startOfWeek(monthStart);
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    month: "long",
    year: "numeric",
  }).format(new Date(`${monthStart}T12:00:00+07:00`));
  const currentMonthNum = monthStart.slice(0, 7);

  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{monthLabel}</h2>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/bookings?view=month&date=${addMonths(monthStart, -1)}`}
            className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-page"
          >
            ← Prev
          </Link>
          <Link
            href={`/dashboard/bookings?view=month&date=${addMonths(monthStart, 1)}`}
            className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-page"
          >
            Next →
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-border bg-border text-xs">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="bg-page px-2 py-1.5 text-center font-medium text-ink-secondary">
            {w}
          </div>
        ))}
        {days.map((day) => {
          const dayBookings = byDay.get(day) ?? [];
          const inMonth = day.slice(0, 7) === currentMonthNum;
          const dayNum = Number(day.slice(8, 10));
          return (
            <Link
              key={day}
              href={`/dashboard/bookings?view=day&date=${day}`}
              className={`flex min-h-24 flex-col gap-1 bg-surface p-1.5 hover:bg-page ${
                inMonth ? "" : "opacity-40"
              }`}
            >
              <div className="font-medium">{dayNum}</div>
              {dayBookings.slice(0, MAX_VISIBLE_PER_DAY).map((b) => (
                <div key={b.id} className="truncate rounded bg-accent/10 px-1 py-0.5 text-[10px] text-ink">
                  {formatTimeOnly(b.startTime)} {b.customerName ?? "Unnamed"}
                </div>
              ))}
              {dayBookings.length > MAX_VISIBLE_PER_DAY && (
                <div className="text-[10px] text-ink-muted">
                  +{dayBookings.length - MAX_VISIBLE_PER_DAY} more
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

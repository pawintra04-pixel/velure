import Link from "next/link";
import type { CalendarBooking } from "@/lib/bookings-data";
import { addDays } from "@/lib/bookings-data";
import { STATUS_STYLE, formatTimeOnly } from "./BookingRow";

function dateKeyInBangkok(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(iso));
}

export function WeekView({
  weekStart,
  bookings,
}: {
  weekStart: string;
  bookings: CalendarBooking[];
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const byDay = new Map<string, CalendarBooking[]>();
  for (const b of bookings) {
    const key = dateKeyInBangkok(b.startTime);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(b);
  }

  const rangeLabel = `${new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", month: "short", day: "numeric" }).format(new Date(`${weekStart}T12:00:00+07:00`))} – ${new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", month: "short", day: "numeric" }).format(new Date(`${addDays(weekStart, 6)}T12:00:00+07:00`))}`;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{rangeLabel}</h2>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/bookings?view=week&date=${addDays(weekStart, -7)}`}
            className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-page"
          >
            ← Prev
          </Link>
          <Link
            href={`/dashboard/bookings?view=week&date=${addDays(weekStart, 7)}`}
            className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-page"
          >
            Next →
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-7">
        {days.map((day) => {
          const dayBookings = byDay.get(day) ?? [];
          const dayLabel = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Bangkok",
            weekday: "short",
            day: "numeric",
          }).format(new Date(`${day}T12:00:00+07:00`));
          return (
            <Link
              key={day}
              href={`/dashboard/bookings?view=day&date=${day}`}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3 hover:border-accent"
            >
              <div className="text-xs font-medium text-ink-secondary">{dayLabel}</div>
              {dayBookings.length === 0 && <div className="text-xs text-ink-muted">—</div>}
              {dayBookings.map((b) => (
                <div key={b.id} className="rounded-lg border border-border px-2 py-1.5 text-xs">
                  <div className="font-medium">{formatTimeOnly(b.startTime)}</div>
                  <div className="truncate text-ink-muted">{b.customerName ?? "Unnamed"}</div>
                  <span
                    className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] ${
                      STATUS_STYLE[b.status] ?? "bg-ink/5 text-ink-muted"
                    }`}
                  >
                    {b.status.replace("_", " ")}
                  </span>
                </div>
              ))}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

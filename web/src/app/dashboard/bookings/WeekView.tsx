import Link from "next/link";
import type { CalendarBooking } from "@/lib/bookings-data";
import { addDays } from "@/lib/bookings-data";
import { formatTimeOnly } from "./BookingRow";
import { statusMeta } from "@/lib/booking-status";
import { bookingsText, type Locale } from "@/lib/i18n";

function dateKeyInBangkok(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(iso));
}

export function WeekView({
  weekStart,
  bookings,
  locale,
  basePath = "/dashboard/bookings",
}: {
  weekStart: string;
  bookings: CalendarBooking[];
  locale: Locale;
  /** Lets the Calendar page reuse this exact view while linking within itself. */
  basePath?: string;
}) {
  const t = bookingsText[locale];
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const byDay = new Map<string, CalendarBooking[]>();
  for (const b of bookings) {
    const key = dateKeyInBangkok(b.startTime);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(b);
  }

  const intlLocale = locale === "th" ? "th-TH" : "en-US";
  const rangeLabel = `${new Intl.DateTimeFormat(intlLocale, { timeZone: "Asia/Bangkok", month: "short", day: "numeric" }).format(new Date(`${weekStart}T12:00:00+07:00`))} – ${new Intl.DateTimeFormat(intlLocale, { timeZone: "Asia/Bangkok", month: "short", day: "numeric" }).format(new Date(`${addDays(weekStart, 6)}T12:00:00+07:00`))}`;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{rangeLabel}</h2>
        <div className="flex gap-2">
          <Link
            href={`${basePath}?view=week&date=${addDays(weekStart, -7)}`}
            className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-page"
          >
            {t.prev}
          </Link>
          <Link
            href={`${basePath}?view=week&date=${addDays(weekStart, 7)}`}
            className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-page"
          >
            {t.next}
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-7">
        {days.map((day) => {
          const dayBookings = byDay.get(day) ?? [];
          const dayLabel = new Intl.DateTimeFormat(intlLocale, {
            timeZone: "Asia/Bangkok",
            weekday: "short",
            day: "numeric",
          }).format(new Date(`${day}T12:00:00+07:00`));
          return (
            <Link
              key={day}
              href={`${basePath}?view=day&date=${day}`}
              className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-2.5 hover:border-ink/25"
            >
              <div className="text-xs font-medium text-ink-secondary">{dayLabel}</div>
              {dayBookings.length === 0 && <div className="text-xs text-ink-muted">—</div>}
              {dayBookings.map((b) => {
                const meta = statusMeta(b.status, locale);
                return (
                  <div key={b.id} className={`rounded-lg px-1.5 py-1 text-xs ${b.isFlagged ? "bg-[#fdf3e6]/60" : ""}`}>
                    <div className="flex items-center gap-1 font-mono">
                      {b.isFlagged && "📌"}
                      {formatTimeOnly(b.startTime)}
                    </div>
                    <div className="truncate text-ink-muted">{b.customerName ?? t.unnamed}</div>
                    <div
                      className={`mt-0.5 flex items-center gap-1 ${meta.strike ? "line-through" : ""}`}
                      style={{ color: meta.color }}
                    >
                      <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: meta.color }} />
                      {meta.label}
                    </div>
                  </div>
                );
              })}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

import Link from "next/link";
import type { CalendarBooking } from "@/lib/bookings-data";
import { addDays, addMonths, startOfWeek } from "@/lib/bookings-data";
import { formatTimeOnly } from "./BookingRow";
import { statusMeta } from "@/lib/booking-status";
import { bookingsText, tMoreCount, type Locale } from "@/lib/i18n";

const WEEKDAY_LABELS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LABELS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MAX_VISIBLE_PER_DAY = 3;

function dateKeyInBangkok(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(iso));
}

export function MonthView({
  monthStart,
  bookings,
  locale,
  basePath = "/dashboard/bookings",
}: {
  monthStart: string; // "YYYY-MM-01"
  bookings: CalendarBooking[];
  locale: Locale;
  basePath?: string;
}) {
  const t = bookingsText[locale];
  const weekdayLabels = locale === "th" ? WEEKDAY_LABELS_TH : WEEKDAY_LABELS_EN;
  const byDay = new Map<string, CalendarBooking[]>();
  for (const b of bookings) {
    const key = dateKeyInBangkok(b.startTime);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(b);
  }

  const gridStart = startOfWeek(monthStart);
  const monthLabel = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
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
            href={`${basePath}?view=month&date=${addMonths(monthStart, -1)}`}
            className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-page"
          >
            {t.prev}
          </Link>
          <Link
            href={`${basePath}?view=month&date=${addMonths(monthStart, 1)}`}
            className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-page"
          >
            {t.next}
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-border bg-border text-xs">
        {weekdayLabels.map((w) => (
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
              href={`${basePath}?view=day&date=${day}`}
              className={`flex min-h-12 flex-col gap-1 bg-surface p-1.5 hover:bg-page sm:min-h-24 ${
                inMonth ? "" : "opacity-40"
              }`}
            >
              <div className="font-medium">{dayNum}</div>

              {/* Mobile: a small dot per booking (colored by status) instead of
                  squeezing full text rows into a ~50px-wide cell. */}
              {dayBookings.length > 0 && (
                <div className="flex flex-wrap items-center gap-0.5 sm:hidden">
                  {dayBookings.slice(0, 6).map((b) => (
                    <span
                      key={b.id}
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: b.isFlagged ? "#a8681c" : statusMeta(b.status, locale).color }}
                    />
                  ))}
                  {dayBookings.length > 6 && (
                    <span className="text-[9px] text-ink-muted">+{dayBookings.length - 6}</span>
                  )}
                </div>
              )}

              {/* Desktop/tablet: real detail, enough width to read it. */}
              <div className="hidden sm:flex sm:flex-col sm:gap-1">
                {dayBookings.slice(0, MAX_VISIBLE_PER_DAY).map((b) => {
                  const meta = statusMeta(b.status, locale);
                  return (
                    <div
                      key={b.id}
                      className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] ${
                        b.isFlagged ? "bg-[#a8681c]/10 text-[#a8681c]" : ""
                      }`}
                      style={!b.isFlagged ? { color: meta.color } : undefined}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: b.isFlagged ? "#a8681c" : meta.color }}
                      />
                      <span className="truncate">
                        {formatTimeOnly(b.startTime)} {b.customerName ?? t.unnamed}
                      </span>
                    </div>
                  );
                })}
                {dayBookings.length > MAX_VISIBLE_PER_DAY && (
                  <div className="text-[10px] text-ink-muted">
                    {tMoreCount(locale, dayBookings.length - MAX_VISIBLE_PER_DAY)}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

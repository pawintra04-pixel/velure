import Link from "next/link";
import type { CalendarBooking } from "@/lib/bookings-data";
import { addDays } from "@/lib/bookings-data";
import { BookingRow, BookingList } from "./BookingRow";
import { bookingsText, type Locale } from "@/lib/i18n";

export function DayView({
  date,
  bookings,
  locale,
}: {
  date: string;
  bookings: CalendarBooking[];
  locale: Locale;
}) {
  const t = bookingsText[locale];
  const label = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
    timeZone: "Asia/Bangkok",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00+07:00`));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{label}</h2>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/bookings?view=day&date=${addDays(date, -1)}`}
            className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-page"
          >
            {t.prev}
          </Link>
          <Link
            href={`/dashboard/bookings?view=day&date=${addDays(date, 1)}`}
            className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-page"
          >
            {t.next}
          </Link>
        </div>
      </div>

      <div className="mt-4">
        {bookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            {t.noBookingsDay}
          </div>
        ) : (
          <BookingList>
            {bookings.map((b) => (
              <BookingRow key={b.id} b={b} locale={locale} />
            ))}
          </BookingList>
        )}
      </div>
    </div>
  );
}

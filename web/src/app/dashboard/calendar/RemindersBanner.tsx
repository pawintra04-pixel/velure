import Link from "next/link";
import type { CalendarBooking, CalendarClassSession } from "@/lib/bookings-data";
import { formatTimeOnly } from "../bookings/BookingRow";

// Surfaces anything an owner flagged or left a note on that's still ahead
// of *real* wall-clock now — not relative to whatever date is being viewed
// — so this naturally goes quiet once the day's flagged items are past.
export function RemindersBanner({
  bookings,
  classSessions,
}: {
  bookings: CalendarBooking[];
  classSessions: CalendarClassSession[];
}) {
  const now = new Date().getTime();
  type Item = { key: string; time: string; label: string; note: string | null; anchor: string };

  const items: Item[] = [
    ...bookings
      .filter((b) => (b.isFlagged || b.ownerNote) && new Date(b.startTime).getTime() >= now)
      .map((b): Item => ({
        key: `b-${b.id}`,
        time: b.startTime,
        label: `${b.serviceName} · ${b.customerName ?? "Unnamed"}`,
        note: b.ownerNote,
        anchor: `#booking-${b.id}`,
      })),
    ...classSessions
      .filter((s) => (s.isFlagged || s.ownerNote) && new Date(s.startTime).getTime() >= now)
      .map((s): Item => ({
        key: `c-${s.id}`,
        time: s.startTime,
        label: `${s.serviceName} · class`,
        note: s.ownerNote,
        anchor: `#class-${s.id}`,
      })),
  ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  if (items.length === 0) return null;

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-[#a8681c]/30 bg-[#fdf3e6] p-4">
      <div className="text-xs font-medium text-[#a8681c]">Reminders</div>
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.anchor}
          className="flex flex-wrap items-center gap-x-2 text-sm text-[#a8681c] hover:underline"
        >
          <span>📌</span>
          <span className="font-medium">{formatTimeOnly(item.time)}</span>
          <span>{item.label}</span>
          {item.note && <span className="opacity-70">— {item.note}</span>}
        </Link>
      ))}
    </div>
  );
}

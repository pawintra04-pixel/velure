import Link from "next/link";
import { bangkokMidnight, todayISOInBangkok } from "@/lib/bookings-data";
import type { CalendarBooking, CalendarClassSession, CalendarStaffBlock } from "@/lib/bookings-data";
import { colorForService } from "@/lib/service-color";
import { statusMeta } from "@/lib/booking-status";

const FLAG_BG = "#fdf3e6";
const FLAG_INK = "#a8681c";
// A booking/class starting within this window (and not yet started) gets a
// "Soon" badge — only meaningful for today, since "soon" relative to any
// other day is either already past or not useful information yet.
const SOON_WINDOW_MINUTES = 45;

export type StaffHoursRow = {
  staff_id: string;
  is_off: boolean;
  start_time: string | null;
  end_time: string | null;
  break_start: string | null;
  break_end: string | null;
};

export type BusinessHoursRow = { is_closed: boolean; open_time: string | null; close_time: string | null };

const PX_PER_MIN = 1.5;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesFromMidnight(iso: string, dateISO: string): number {
  return Math.round((new Date(iso).getTime() - bangkokMidnight(dateISO).getTime()) / 60_000);
}

function formatTimeOnly(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

// A class/booking's colored block on the grid is deliberately tiny (one or
// two lines, see the tight px-1.5/py-0.5 sizing below) — the full picture
// (room, exact times, who's booked) lives in this native-tooltip title
// instead of trying to cram it into the block itself. Same info a click
// through to the detail card below shows, just reachable on hover too.
const HIDDEN_STATUSES = ["CANCELLED", "EXPIRED", "PAYMENT_FAILED"];

// Staff names often carry a parenthetical role/title (e.g. "Somchai (Massage
// Therapist)") — real, useful info, but wrong for a compact per-column
// header: it doesn't summarize into initials cleanly ("(" isn't a letter)
// and repeating one fixed role at the top of a column that can run several
// different bookings/classes across the day reads as misleading, not
// helpful. Stripped here for both the avatar and the header label; the full
// name (role included) is still one hover away via the `title` attribute.
function stripParenthetical(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, "").trim() || name;
}

function initials(name: string): string {
  return stripParenthetical(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function CalendarGrid({
  dateISO,
  staff,
  businessHours,
  staffHoursByStaff,
  bookings,
  allBookings,
  classSessions,
  blocks,
}: {
  dateISO: string;
  staff: { id: string; name: string }[];
  businessHours: BusinessHoursRow | null;
  staffHoursByStaff: Map<string, StaffHoursRow>;
  bookings: CalendarBooking[];
  /** Unfiltered, includes class attendees — used only to list "who's booked" in a class's tooltip. */
  allBookings: CalendarBooking[];
  classSessions: CalendarClassSession[];
  blocks: CalendarStaffBlock[];
}) {
  if (!businessHours || businessHours.is_closed) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-ink-muted">
        Closed on this day — change your hours on the{" "}
        <Link href="/dashboard/settings" className="text-accent underline">
          Settings
        </Link>{" "}
        page.
      </div>
    );
  }

  if (staff.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-8 text-sm text-ink-muted">
        <p>Add a team member to see their schedule here.</p>
        <Link
          href="/dashboard/staff"
          className="rounded-xl bg-sunburst px-4 py-2.5 text-sm font-medium text-ink"
        >
          Go to Team
        </Link>
      </div>
    );
  }

  const gridOpen = Math.floor(timeToMinutes(businessHours.open_time!) / 60) * 60;
  const gridClose = Math.ceil(timeToMinutes(businessHours.close_time!) / 60) * 60;
  const totalMinutes = gridClose - gridOpen;
  const totalHeightPx = totalMinutes * PX_PER_MIN;

  const isToday = dateISO === todayISOInBangkok();
  const nowMinutes = isToday ? minutesFromMidnight(new Date().toISOString(), dateISO) : null;
  const nowLineTop =
    nowMinutes !== null && nowMinutes >= gridOpen && nowMinutes <= gridClose
      ? (nowMinutes - gridOpen) * PX_PER_MIN
      : null;
  function isStartingSoon(startISO: string): boolean {
    if (nowMinutes === null) return false;
    const startMin = minutesFromMidnight(startISO, dateISO);
    return startMin > nowMinutes && startMin - nowMinutes <= SOON_WINDOW_MINUTES;
  }

  const hourMarks: { minute: number; top: number; label: string }[] = [];
  for (let m = gridOpen; m <= gridClose; m += 60) {
    const d = new Date(bangkokMidnight(dateISO).getTime() + m * 60_000);
    hourMarks.push({
      minute: m,
      top: (m - gridOpen) * PX_PER_MIN,
      label: new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", hour: "numeric" }).format(d),
    });
  }

  function clampedRect(startISO: string, endISO: string): { top: number; height: number } | null {
    const start = Math.max(minutesFromMidnight(startISO, dateISO), gridOpen);
    const end = Math.min(minutesFromMidnight(endISO, dateISO), gridClose);
    if (end <= start) return null;
    return { top: (start - gridOpen) * PX_PER_MIN, height: Math.max((end - start) * PX_PER_MIN, 20) };
  }

  const bookingsByStaff = new Map<string, CalendarBooking[]>();
  for (const b of bookings) {
    if (!bookingsByStaff.has(b.staffId)) bookingsByStaff.set(b.staffId, []);
    bookingsByStaff.get(b.staffId)!.push(b);
  }
  const sessionsByStaff = new Map<string, CalendarClassSession[]>();
  for (const s of classSessions) {
    if (!sessionsByStaff.has(s.staffId)) sessionsByStaff.set(s.staffId, []);
    sessionsByStaff.get(s.staffId)!.push(s);
  }
  const blocksByStaff = new Map<string, CalendarStaffBlock[]>();
  for (const b of blocks) {
    if (!blocksByStaff.has(b.staffId)) blocksByStaff.set(b.staffId, []);
    blocksByStaff.get(b.staffId)!.push(b);
  }

  const attendeeNamesBySession = new Map<string, string[]>();
  for (const b of allBookings) {
    if (!b.classSessionId || HIDDEN_STATUSES.includes(b.status)) continue;
    if (!attendeeNamesBySession.has(b.classSessionId)) attendeeNamesBySession.set(b.classSessionId, []);
    attendeeNamesBySession.get(b.classSessionId)!.push(b.customerName ?? "Unnamed customer");
  }

  function classTooltip(session: CalendarClassSession): string {
    const attendees = attendeeNamesBySession.get(session.id) ?? [];
    return [
      session.serviceName,
      session.resourceName ? `Room: ${session.resourceName}` : null,
      `${formatTimeOnly(session.startTime)}–${formatTimeOnly(session.endTime)}`,
      `${session.seatsBooked}/${session.capacity} booked`,
      attendees.length > 0 ? `Attendees: ${attendees.join(", ")}` : "No one booked yet",
    ]
      .filter(Boolean)
      .join("\n");
  }

  function bookingTooltip(booking: CalendarBooking): string {
    return [
      booking.serviceName,
      `${formatTimeOnly(booking.startTime)}–${formatTimeOnly(booking.endTime)}`,
      booking.customerName ?? "Unnamed customer",
      booking.status.replace("_", " "),
    ].join("\n");
  }

  const HEADER_HEIGHT = 56; // px, matches h-14 on the header row below

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <div className="relative flex w-full">
        {nowLineTop !== null && (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
            style={{ top: HEADER_HEIGHT + nowLineTop }}
          >
            <span className="ml-1 h-2 w-2 shrink-0 rounded-full bg-sunburst" />
            <span className="h-px flex-1 bg-sunburst" />
          </div>
        )}
        <div className="w-14 shrink-0 border-r border-border">
          <div className="h-14 border-b border-border" />
          <div className="relative" style={{ height: totalHeightPx }}>
            {hourMarks.map((hm) => (
              <div
                key={hm.minute}
                className="absolute right-2 -translate-y-1/2 text-xs text-ink-muted"
                style={{ top: hm.top }}
              >
                {hm.label}
              </div>
            ))}
          </div>
        </div>

        {staff.map((member) => {
          const hours = staffHoursByStaff.get(member.id);
          const isOff = !hours || hours.is_off;
          const breakRect =
            hours?.break_start && hours?.break_end
              ? {
                  top: Math.max(timeToMinutes(hours.break_start) - gridOpen, 0) * PX_PER_MIN,
                  height: (timeToMinutes(hours.break_end) - timeToMinutes(hours.break_start)) * PX_PER_MIN,
                }
              : null;

          return (
            <div key={member.id} className="min-w-[160px] flex-1 border-r border-border last:border-r-0">
              <div className="flex h-14 items-center gap-2 border-b border-border px-3" title={member.name}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-page text-xs font-medium text-ink-secondary">
                  {initials(member.name)}
                </span>
                <span className="truncate text-sm font-medium">{stripParenthetical(member.name)}</span>
              </div>

              <div className="relative" style={{ height: totalHeightPx }}>
                {hourMarks.map((hm) => (
                  <div
                    key={hm.minute}
                    className="absolute inset-x-0 border-t border-gridline"
                    style={{ top: hm.top }}
                  />
                ))}

                {isOff && (
                  <div className="absolute inset-0 flex items-center justify-center bg-page/70 text-xs text-ink-muted">
                    Off today
                  </div>
                )}

                {!isOff && breakRect && breakRect.height > 0 && (
                  <div
                    className="absolute inset-x-0 flex items-center justify-center bg-page/70 text-xs text-ink-muted"
                    style={{ top: breakRect.top, height: breakRect.height }}
                  >
                    Break
                  </div>
                )}

                {!isOff &&
                  (blocksByStaff.get(member.id) ?? []).map((blk) => {
                    const rect = clampedRect(blk.startTime, blk.endTime);
                    if (!rect) return null;
                    return (
                      <div
                        key={blk.id}
                        className="absolute inset-x-1 overflow-hidden rounded-lg bg-ink-muted/20 px-1.5 py-0.5 text-xs leading-tight text-ink-secondary"
                        style={{ top: rect.top, height: rect.height }}
                      >
                        <div className="truncate font-medium">Busy</div>
                        {blk.reason && <div className="truncate">{blk.reason}</div>}
                      </div>
                    );
                  })}

                {!isOff &&
                  (sessionsByStaff.get(member.id) ?? []).map((session) => {
                    const rect = clampedRect(session.startTime, session.endTime);
                    if (!rect) return null;
                    const color = session.isFlagged
                      ? { bg: FLAG_BG, ink: FLAG_INK }
                      : colorForService(session.serviceName);
                    const soon = isStartingSoon(session.startTime);
                    return (
                      <Link
                        key={session.id}
                        href={`#class-${session.id}`}
                        title={classTooltip(session)}
                        className="absolute inset-x-1 overflow-hidden rounded-lg px-1.5 py-0.5 text-xs leading-tight"
                        style={{ top: rect.top, height: rect.height, backgroundColor: color.bg, color: color.ink }}
                      >
                        <div className="truncate font-medium">
                          {session.isFlagged && "📌 "}
                          {session.serviceName}
                        </div>
                        <div className="truncate opacity-80">
                          {session.seatsBooked}/{session.capacity}
                          {soon && " · Soon"}
                        </div>
                      </Link>
                    );
                  })}

                {!isOff &&
                  (bookingsByStaff.get(member.id) ?? []).map((booking) => {
                    const rect = clampedRect(booking.startTime, booking.endTime);
                    if (!rect) return null;
                    // Semantic status color, not service color — confirmed
                    // reads green, pending amber, no-show/failed red,
                    // everywhere the same meaning as the schedule list and
                    // the Overview page. Flag stays its own distinct amber
                    // tint since it's orthogonal metadata, not a status.
                    const meta = statusMeta(booking.status);
                    const color = booking.isFlagged
                      ? { bg: FLAG_BG, ink: FLAG_INK }
                      : { bg: `color-mix(in srgb, ${meta.color} 14%, white)`, ink: meta.color };
                    const pending = booking.status === "TEMPORARY_HOLD" || booking.status === "PAYMENT_PENDING";
                    const soon = isStartingSoon(booking.startTime);
                    return (
                      <Link
                        key={booking.id}
                        href={`#booking-${booking.id}`}
                        title={bookingTooltip(booking)}
                        className="absolute inset-x-1 overflow-hidden rounded-lg border-l-4 px-1.5 py-0.5 text-xs leading-tight"
                        style={{
                          top: rect.top,
                          height: rect.height,
                          backgroundColor: color.bg,
                          color: color.ink,
                          borderLeftColor: color.ink,
                        }}
                      >
                        <div className={`truncate font-medium ${meta.strike ? "line-through" : ""}`}>
                          {booking.isFlagged && "📌 "}
                          {booking.serviceName}
                        </div>
                        <div className="truncate opacity-80">
                          {booking.customerName ?? (pending ? "Pending details" : "Walk-in")}
                          {soon && " · Soon"}
                        </div>
                      </Link>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import type { CalendarBooking, CalendarClassSession } from "@/lib/bookings-data";
import { BookingRow, BookingList, formatTime } from "../bookings/BookingRow";
import { updateClassSessionNote } from "../classes/actions";

// Every attendee of a class session shares the class's own booking row, but
// they're grouped under one ClassSessionDetail card (with a roster) instead
// of listed loose alongside 1:1 bookings — mirrors how CalendarGrid renders
// one block per session rather than one per attendee.
export function DayDetailList({
  bookings,
  classSessions,
}: {
  bookings: CalendarBooking[];
  classSessions: CalendarClassSession[];
}) {
  const regular = bookings.filter((b) => !b.classSessionId);
  const attendeesBySession = new Map<string, CalendarBooking[]>();
  for (const b of bookings) {
    if (!b.classSessionId) continue;
    if (!attendeesBySession.has(b.classSessionId)) attendeesBySession.set(b.classSessionId, []);
    attendeesBySession.get(b.classSessionId)!.push(b);
  }

  type Entry =
    | { type: "booking"; time: string; booking: CalendarBooking }
    | { type: "class"; time: string; session: CalendarClassSession };

  const entries: Entry[] = [
    ...regular.map((b): Entry => ({ type: "booking", time: b.startTime, booking: b })),
    ...classSessions.map((s): Entry => ({ type: "class", time: s.startTime, session: s })),
  ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  if (entries.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
        No bookings on this day.
      </div>
    );
  }

  // Consecutive 1:1 bookings share one BookingList (thin dividers, one
  // container) rather than each getting its own bordered card; a class
  // session breaks the run since it renders as its own detail card.
  const renderBlocks: React.ReactNode[] = [];
  let runStart = 0;
  while (runStart < entries.length) {
    const entry = entries[runStart];
    if (entry.type === "class") {
      renderBlocks.push(
        <ClassSessionDetail
          key={entry.session.id}
          session={entry.session}
          attendees={attendeesBySession.get(entry.session.id) ?? []}
        />
      );
      runStart += 1;
      continue;
    }
    let runEnd = runStart;
    while (runEnd < entries.length && entries[runEnd].type === "booking") runEnd += 1;
    const run = entries.slice(runStart, runEnd) as Extract<Entry, { type: "booking" }>[];
    renderBlocks.push(
      <BookingList key={`run-${run[0].booking.id}`}>
        {run.map((r) => (
          <BookingRow key={r.booking.id} b={r.booking} />
        ))}
      </BookingList>
    );
    runStart = runEnd;
  }

  return <div className="mt-4 flex flex-col gap-4">{renderBlocks}</div>;
}

function ClassSessionDetail({
  session,
  attendees,
}: {
  session: CalendarClassSession;
  attendees: CalendarBooking[];
}) {
  return (
    <div
      id={`class-${session.id}`}
      className={`rounded-2xl border p-5 ${
        session.isFlagged ? "border-[#a8681c]/40 bg-[#fdf3e6]/40" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-center gap-1.5 font-medium">
        {session.isFlagged && <span title="Flagged for special attention">📌</span>}
        {session.serviceName}
        <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-normal text-ink-secondary">Class</span>
      </div>
      <div className="mt-1 text-sm text-ink-muted">
        {formatTime(session.startTime)} · {session.staffName}
        {session.resourceName && <> · {session.resourceName}</>} · {session.seatsBooked}/{session.capacity} booked
      </div>
      {session.ownerNote && <div className="mt-1 text-sm text-[#a8681c]">{session.ownerNote}</div>}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink-secondary">
          Note &amp; flag
        </summary>
        <form
          action={updateClassSessionNote}
          className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <input type="hidden" name="sessionId" value={session.id} />
          <input
            name="note"
            defaultValue={session.ownerNote ?? ""}
            placeholder="e.g. VIP attendee, needs extra care"
            className="flex-1 rounded-lg border border-border px-3 py-1.5 text-sm"
          />
          <label className="flex items-center gap-1.5 text-sm text-ink-secondary">
            <input type="checkbox" name="flagged" defaultChecked={session.isFlagged} />
            Flag
          </label>
          <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-page">
            Save
          </button>
        </form>
      </details>

      <div className="mt-4 border-t border-border pt-3">
        <div className="text-xs font-medium text-ink-secondary">Attendees ({attendees.length})</div>
        {attendees.length === 0 ? (
          <div className="mt-2 text-sm text-ink-muted">No one booked yet.</div>
        ) : (
          <div className="mt-1 divide-y divide-border">
            {attendees.map((a) => (
              <BookingRow key={a.id} b={a} compact />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

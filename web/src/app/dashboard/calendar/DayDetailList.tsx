import type { CalendarBooking, CalendarClassSession } from "@/lib/bookings-data";
import { BookingRow, BookingList, formatTime } from "../bookings/BookingRow";
import { updateClassSessionNote, reassignClassSessionStaff } from "../classes/actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { calendarText, type Locale } from "@/lib/i18n";

// Every attendee of a class session shares the class's own booking row, but
// they're grouped under one ClassSessionDetail card (with a roster) instead
// of listed loose alongside 1:1 bookings — mirrors how CalendarGrid renders
// one block per session rather than one per attendee.
export function DayDetailList({
  bookings,
  classSessions,
  staff,
  locale,
}: {
  bookings: CalendarBooking[];
  classSessions: CalendarClassSession[];
  staff: { id: string; name: string }[];
  locale: Locale;
}) {
  const t = calendarText[locale];
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
        {t.noBookingsDay}
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
          staff={staff}
          locale={locale}
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
          <BookingRow key={r.booking.id} b={r.booking} locale={locale} />
        ))}
      </BookingList>
    );
    runStart = runEnd;
  }

  return <div className="mt-4 flex flex-col gap-4">{renderBlocks}</div>;
}

export function ClassSessionDetail({
  session,
  attendees,
  staff,
  locale,
  inPopup = false,
}: {
  session: CalendarClassSession;
  attendees: CalendarBooking[];
  staff: { id: string; name: string }[];
  locale: Locale;
  inPopup?: boolean;
}) {
  const t = calendarText[locale];
  return (
    <div
      id={inPopup ? undefined : `class-${session.id}`}
      className={`rounded-2xl border p-5 ${
        session.isFlagged ? "border-[#a8681c]/40 bg-[#fdf3e6]/40" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-center gap-1.5 font-medium">
        {session.isFlagged && <span title="Flagged for special attention">📌</span>}
        {session.serviceName}
        <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-normal text-ink-secondary">{t.class}</span>
      </div>
      <div className="mt-1 text-sm text-ink-muted">
        {formatTime(session.startTime)} · {session.staffName}
        {session.resourceName && <> · {session.resourceName}</>} · {session.seatsBooked}/{session.capacity} {t.booked}
      </div>
      {session.ownerNote && <div className="mt-1 text-sm text-[#a8681c]">{session.ownerNote}</div>}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink-secondary">
          {t.noteAndFlag}
        </summary>
        <form
          action={updateClassSessionNote}
          className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <input type="hidden" name="sessionId" value={session.id} />
          <input
            name="note"
            defaultValue={session.ownerNote ?? ""}
            placeholder={t.notePlaceholder}
            className="flex-1 rounded-lg border border-border px-3 py-1.5 text-sm"
          />
          <label className="flex items-center gap-1.5 text-sm text-ink-secondary">
            <input type="checkbox" name="flagged" defaultChecked={session.isFlagged} />
            {t.flag}
          </label>
          <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-page">
            {t.save}
          </button>
        </form>
      </details>

      {staff.length > 1 && (
        <div className="mt-3">
          <ConfirmSubmitButton
            action={reassignClassSessionStaff}
            hiddenFields={{ sessionId: session.id }}
            label={t.changeTeacherButton}
            pendingLabel={t.changing}
            confirmTitle={t.changeTeacherTitle}
            confirmDescription={t.changeTeacherDesc}
            confirmLabel={t.changeTeacherButton}
            cancelLabel={t.goBack}
            formClassName="flex flex-wrap items-center gap-2"
            buttonClassName="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-page"
          >
            <label className="text-xs text-ink-secondary" htmlFor={`teacher-${session.id}`}>
              {t.changeTeacher}
            </label>
            <select
              // keyed on the current teacher so the uncontrolled select
              // resets to the new value after a successful change
              key={session.staffId}
              id={`teacher-${session.id}`}
              name="staffId"
              defaultValue={session.staffId}
              className="rounded-lg border border-border px-2 py-1.5 text-sm"
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </ConfirmSubmitButton>
        </div>
      )}

      <div className="mt-4 border-t border-border pt-3">
        <div className="text-xs font-medium text-ink-secondary">{t.attendees} ({attendees.length})</div>
        {attendees.length === 0 ? (
          <div className="mt-2 text-sm text-ink-muted">{t.noOneBookedYet}</div>
        ) : (
          <div className="mt-1 divide-y divide-border">
            {attendees.map((a) => (
              <BookingRow key={a.id} b={a} locale={locale} compact />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

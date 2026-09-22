import { resourcesText, type Locale } from "@/lib/i18n";

export type RoomOccupant = {
  kind: "class" | "booking";
  id: string;
  startTime: string;
  endTime: string;
  serviceName: string;
  staffName: string;
  ownerNote: string | null;
  isFlagged: boolean;
  seatsBooked: number | null;
  capacity: number | null;
  customerName: string | null;
};

type BusinessHours = { is_closed: boolean; open_time: string | null; close_time: string | null } | null;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function minutesFromMidnight(iso: string, dateISO: string): number {
  const midnight = new Date(`${dateISO}T00:00:00+07:00`).getTime();
  return Math.round((new Date(iso).getTime() - midnight) / 60_000);
}

// A room's day read as one story instead of a grid: what's happening, in
// order, with the free stretches between named explicitly — this is meant
// to answer "what does this room's whole day look like" at a glance, which
// is a different job than the booking-focused staff-column Calendar grid.
export function RoomTimeline({
  businessHours,
  occupants,
  dateISO,
  locale,
}: {
  businessHours: BusinessHours;
  occupants: RoomOccupant[];
  dateISO: string;
  locale: Locale;
}) {
  const t = resourcesText[locale];

  if (!businessHours || businessHours.is_closed) {
    return <div className="py-8 text-center text-sm text-ink-muted">{t.closedOnThisDay}</div>;
  }

  const gridOpen = timeToMinutes(businessHours.open_time!);
  const gridClose = timeToMinutes(businessHours.close_time!);

  const sorted = [...occupants].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  type Row =
    | { type: "occupied"; occupant: RoomOccupant }
    | { type: "free"; start: number; end: number };

  const rows: Row[] = [];
  let cursor = gridOpen;
  for (const occ of sorted) {
    const start = Math.max(minutesFromMidnight(occ.startTime, dateISO), gridOpen);
    const end = Math.min(minutesFromMidnight(occ.endTime, dateISO), gridClose);
    if (end <= gridOpen || start >= gridClose) continue;
    if (start > cursor) rows.push({ type: "free", start: cursor, end: start });
    rows.push({ type: "occupied", occupant: occ });
    cursor = Math.max(cursor, end);
  }
  if (cursor < gridClose) rows.push({ type: "free", start: cursor, end: gridClose });

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-ink-muted">
        {t.open} {formatClock(gridOpen)} – {formatClock(gridClose)}
      </div>
      {rows.map((row, i) =>
        row.type === "free" ? (
          <div
            key={`free-${i}`}
            className="rounded-xl border border-dashed border-border px-4 py-2.5 text-sm text-ink-muted"
          >
            {t.free} · {formatClock(row.start)} – {formatClock(row.end)} ({formatDuration(row.end - row.start)})
          </div>
        ) : (
          <div
            key={row.occupant.id}
            className={`rounded-xl border p-4 ${
              row.occupant.isFlagged ? "border-[#a8681c]/40 bg-[#fdf3e6]/40" : "border-border bg-surface"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-medium">
                  {row.occupant.isFlagged && <span title="Flagged for special attention">📌</span>}
                  {row.occupant.serviceName}
                  {row.occupant.kind === "class" && (
                    <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-normal text-ink-secondary">
                      {t.class}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-sm text-ink-muted">
                  {formatClock(minutesFromMidnight(row.occupant.startTime, dateISO))} –{" "}
                  {formatClock(minutesFromMidnight(row.occupant.endTime, dateISO))} · {row.occupant.staffName}
                  {row.occupant.kind === "class"
                    ? ` · ${row.occupant.seatsBooked}/${row.occupant.capacity} ${t.booked}`
                    : ` · ${row.occupant.customerName ?? t.unnamedCustomer}`}
                </div>
                {row.occupant.ownerNote && (
                  <div className="mt-1 text-sm text-[#a8681c]">{row.occupant.ownerNote}</div>
                )}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}

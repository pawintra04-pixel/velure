import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { bangkokMidnight, todayISOInBangkok, addDays } from "@/lib/bookings-data";
import { RoomForm } from "./RoomForm";
import { deleteResource, toggleResourceActive } from "./actions";
import { RoomTimeline, type RoomOccupant } from "./RoomTimeline";
import { PageShell, PageHeader } from "@/components/dashboard/PageShell";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { resourcesText, tRemoveResourceTitle, type Locale } from "@/lib/i18n";

function toISO(d: Date): string {
  return d.toISOString();
}

// Postgres EXTRACT(DOW)/JS getUTCDay both use 0=Sunday..6=Saturday — same
// technique availability.ts uses to read a date-only string's weekday.
function dayOfWeek(dateISO: string): number {
  return new Date(`${dateISO}T00:00:00Z`).getUTCDay();
}

export default async function StudiosPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; date?: string }>;
}) {
  const owner = await requireOwner();
  const locale = owner.locale;
  const t = resourcesText[locale];
  const { room, date = todayISOInBangkok() } = await searchParams;

  const { rooms } = await withBusinessContext(owner.businessId, async (c) => {
    const roomsResult = await c.query<{ id: string; name: string; is_active: boolean }>(
      `SELECT id, name, is_active FROM resources ORDER BY name`
    );
    return { rooms: roomsResult.rows };
  });

  const activeRoomId = room ?? rooms[0]?.id ?? null;
  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;

  return (
    <PageShell width="standard">
      <div className="border-b border-border pb-5">
        <PageHeader
          title={t.title}
          description={t.description}
          actions={<RoomForm locale={locale} />}
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {rooms.map((r) => (
          <Link
            key={r.id}
            href={`/dashboard/studios?room=${r.id}&date=${date}`}
            className={`rounded-full px-4 py-1.5 text-sm ${
              r.id === activeRoomId
                ? "bg-midnight text-sunburst"
                : r.is_active
                  ? "border border-border text-ink-secondary hover:bg-page"
                  : "border border-dashed border-border text-ink-muted hover:bg-page"
            }`}
          >
            {r.name}
            {!r.is_active && <span className="ml-1.5 text-[11px]">{t.closed}</span>}
          </Link>
        ))}
      </div>

      {rooms.length === 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
          {t.noResourcesYet}
        </div>
      )}

      {activeRoom && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg text-ink">{activeRoom.name}</h2>
                {!activeRoom.is_active && (
                  <span className="rounded-full bg-[#fdf3e6] px-2 py-0.5 text-[11px] font-medium text-[#a8681c]">
                    {t.closedTemporarily}
                  </span>
                )}
              </div>
              <div className="text-sm text-ink-secondary">
                {new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
                  timeZone: "Asia/Bangkok",
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }).format(new Date(`${date}T12:00:00+07:00`))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/studios?room=${activeRoom.id}&date=${todayISOInBangkok()}`}
                className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-page"
              >
                {t.today}
              </Link>
              <Link
                href={`/dashboard/studios?room=${activeRoom.id}&date=${addDays(date, -1)}`}
                className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-page"
              >
                {t.prev}
              </Link>
              <Link
                href={`/dashboard/studios?room=${activeRoom.id}&date=${addDays(date, 1)}`}
                className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-page"
              >
                {t.next}
              </Link>
            </div>
          </div>

          <div className="p-5">
            <RoomSchedule businessId={owner.businessId} roomId={activeRoom.id} date={date} locale={locale} />
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-border px-5 py-3">
            <ConfirmSubmitButton
              action={toggleResourceActive}
              hiddenFields={{ resourceId: activeRoom.id, nextActive: String(!activeRoom.is_active) }}
              label={activeRoom.is_active ? t.closeTemporarily : t.reopen}
              pendingLabel={t.working}
              confirmTitle={activeRoom.is_active ? t.closeRoomTitle : t.reopenRoomTitle}
              confirmDescription={
                <>
                  <strong className="text-ink">{activeRoom.name}</strong>
                  <p className="mt-2">{activeRoom.is_active ? t.closeRoomDesc : t.reopenRoomDesc}</p>
                </>
              }
              confirmLabel={activeRoom.is_active ? t.closeTemporarily : t.reopen}
              cancelLabel={t.goBack}
              buttonClassName="text-xs text-ink-muted hover:text-ink-secondary"
            />
            <ConfirmSubmitButton
              action={deleteResource}
              hiddenFields={{ resourceId: activeRoom.id }}
              label={t.removeResource}
              pendingLabel={t.removing}
              confirmTitle={tRemoveResourceTitle(locale, activeRoom.name)}
              confirmDescription={t.removeResourceDesc}
              confirmLabel={t.remove}
              cancelLabel={t.goBack}
              danger
              buttonClassName="text-xs text-ink-muted hover:text-[#d03b3b]"
            />
          </div>
        </div>
      )}
    </PageShell>
  );
}

async function RoomSchedule({
  businessId,
  roomId,
  date,
  locale,
}: {
  businessId: string;
  roomId: string;
  date: string;
  locale: Locale;
}) {
  const dow = dayOfWeek(date);
  const dayStart = toISO(bangkokMidnight(date));
  const dayEnd = toISO(bangkokMidnight(addDays(date, 1)));

  const { businessHours, occupants } = await withBusinessContext(businessId, async (c) => {
    const { rows: [hours] } = await c.query<{
      is_closed: boolean;
      open_time: string | null;
      close_time: string | null;
    }>(
      `SELECT is_closed, open_time, close_time FROM business_hours
       WHERE business_id = $1 AND day_of_week = $2`,
      [businessId, dow]
    );

    const { rows: classRows } = await c.query(
      `SELECT cs.id, cs.start_time, cs.end_time, s.name AS service_name, st.name AS staff_name,
              cs.owner_note, cs.is_flagged, cs.seats_booked, cs.capacity
       FROM class_sessions cs
       JOIN services s ON s.id = cs.service_id
       JOIN staff st ON st.id = cs.staff_id
       WHERE cs.resource_id = $1 AND cs.start_time >= $2 AND cs.start_time < $3`,
      [roomId, dayStart, dayEnd]
    );
    const { rows: bookingRows } = await c.query(
      `SELECT b.id, b.start_time, b.end_time, s.name AS service_name, st.name AS staff_name,
              b.owner_note, b.is_flagged, cu.name AS customer_name
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN staff st ON st.id = b.staff_id
       LEFT JOIN customers cu ON cu.id = b.customer_id
       WHERE b.resource_id = $1 AND b.start_time >= $2 AND b.start_time < $3
         AND b.status IN ('TEMPORARY_HOLD', 'PAYMENT_PENDING', 'CONFIRMED')`,
      [roomId, dayStart, dayEnd]
    );

    const occupants: RoomOccupant[] = [
      ...classRows.map((r): RoomOccupant => ({
        kind: "class",
        id: r.id,
        startTime: r.start_time,
        endTime: r.end_time,
        serviceName: r.service_name,
        staffName: r.staff_name,
        ownerNote: r.owner_note,
        isFlagged: r.is_flagged,
        seatsBooked: r.seats_booked,
        capacity: r.capacity,
        customerName: null,
      })),
      ...bookingRows.map((r): RoomOccupant => ({
        kind: "booking",
        id: r.id,
        startTime: r.start_time,
        endTime: r.end_time,
        serviceName: r.service_name,
        staffName: r.staff_name,
        ownerNote: r.owner_note,
        isFlagged: r.is_flagged,
        seatsBooked: null,
        capacity: null,
        customerName: r.customer_name,
      })),
    ];

    return { businessHours: hours ?? null, occupants };
  });

  return <RoomTimeline businessHours={businessHours} occupants={occupants} dateISO={date} locale={locale} />;
}

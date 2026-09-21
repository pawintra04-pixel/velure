import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { CreateSessionForm } from "./CreateSessionForm";
import { deleteClassSession, updateClassSessionNote } from "./actions";
import { PageShell, PageHeader } from "@/components/dashboard/PageShell";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function ClassesPage() {
  const owner = await requireOwner();

  const { sessions, classServices, staff, resources } = await withBusinessContext(
    owner.businessId,
    async (c) => {
      const sessionsResult = await c.query(
        `SELECT cs.id, cs.start_time, cs.capacity, cs.seats_booked, cs.owner_note, cs.is_flagged,
                s.name AS service_name, st.name AS staff_name, r.name AS resource_name
         FROM class_sessions cs
         JOIN services s ON s.id = cs.service_id
         JOIN staff st ON st.id = cs.staff_id
         LEFT JOIN resources r ON r.id = cs.resource_id
         WHERE cs.start_time >= now()
         ORDER BY cs.start_time`
      );
      const classServicesResult = await c.query(
        `SELECT id, name FROM services WHERE capacity IS NOT NULL AND capacity >= 2 ORDER BY name`
      );
      const staffResult = await c.query(`SELECT id, name FROM staff ORDER BY name`);
      // Only rooms currently in service can be assigned to a NEW session —
      // one closed "temporarily" (see Resources) shouldn't be offered here
      // even though its existing sessions/bookings are untouched.
      const resourcesResult = await c.query(
        `SELECT id, name FROM resources WHERE is_active ORDER BY name`
      );
      return {
        sessions: sessionsResult.rows,
        classServices: classServicesResult.rows,
        staff: staffResult.rows,
        resources: resourcesResult.rows,
      };
    }
  );

  const hasClassServices = classServices.length > 0;

  return (
    <PageShell width="standard">
      <div className="border-b border-border pb-5">
        <PageHeader
          title="Classes"
          description="Scheduled sessions for your multi-seat services — customers book a seat, up to capacity."
        />
      </div>

      {!hasClassServices ? (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-8">
          <div className="text-[15px] text-ink">Classes aren&rsquo;t set up yet</div>
          <p className="max-w-md text-sm text-ink-secondary">
            Set a service&apos;s capacity to 2 or more on the Services page to turn it into a
            class, then come back here to schedule sessions for it.
          </p>
          <Link
            href="/dashboard/services"
            className="rounded-lg bg-sunburst px-4 py-2 text-sm font-medium text-ink transition-[filter] hover:brightness-95"
          >
            Go to Services
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-3">
            {sessions.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
                No upcoming sessions yet — schedule one below.
              </div>
            )}
            {sessions.map((s) => (
          <div
            key={s.id}
            id={`class-${s.id}`}
            className={`rounded-2xl border bg-surface p-5 ${
              s.is_flagged ? "border-[#a8681c]/40 bg-[#fdf3e6]/40" : "border-border"
            }`}
          >
            {/* sm:flex-wrap: see StaffCard.tsx for why — the Remove trigger
                can render a full-sentence error below itself, which needs
                the button cluster free to drop to its own line rather than
                starving the min-w-0 name/detail column next to it. */}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-medium">
                  {s.is_flagged && <span title="Flagged for special attention">📌</span>}
                  {s.service_name}
                </div>
                <div className="mt-1 text-sm text-ink-muted">
                  {formatTime(s.start_time)} · {s.staff_name}
                  {s.resource_name && <> · {s.resource_name}</>}
                </div>
                {s.owner_note && <div className="mt-1 text-sm text-[#a8681c]">{s.owner_note}</div>}
              </div>
              <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                <div className="text-sm text-ink-secondary">
                  {s.seats_booked} / {s.capacity} booked
                </div>
                <ConfirmSubmitButton
                  action={deleteClassSession}
                  hiddenFields={{ sessionId: s.id }}
                  label="Remove"
                  pendingLabel="Removing…"
                  confirmTitle="Remove this session?"
                  confirmDescription="This removes the session from the schedule. Sessions with any booking history — including past or cancelled bookings — can't be removed, to keep existing reports accurate."
                  confirmLabel="Remove"
                  danger
                  buttonClassName="rounded-full border border-border px-3 py-1.5 text-sm text-ink-secondary hover:bg-page"
                />
              </div>
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink-secondary">
                Note &amp; flag
              </summary>
              <form
                action={updateClassSessionNote}
                className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center"
              >
                <input type="hidden" name="sessionId" value={s.id} />
                <input
                  name="note"
                  defaultValue={s.owner_note ?? ""}
                  placeholder="e.g. VIP attendee, needs extra care"
                  className="flex-1 rounded-lg border border-border px-3 py-1.5 text-sm"
                />
                <label className="flex items-center gap-1.5 text-sm text-ink-secondary">
                  <input type="checkbox" name="flagged" defaultChecked={s.is_flagged} />
                  Flag
                </label>
                <button
                  type="submit"
                  className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-page"
                >
                  Save
                </button>
              </form>
            </details>
          </div>
        ))}
          </div>

          <div className="mt-8">
            <h2 className="text-[13.5px] font-semibold uppercase tracking-wide text-ink">
              Schedule a session
            </h2>
            <div className="mt-2">
              <CreateSessionForm services={classServices} staff={staff} resources={resources} />
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}

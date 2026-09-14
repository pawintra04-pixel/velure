import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { CreateSessionForm } from "./CreateSessionForm";
import { deleteClassSession } from "./actions";

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function ClassesPage() {
  const owner = await requireOwner();

  const { sessions, classServices, staff } = await withBusinessContext(owner.businessId, async (c) => {
    const sessionsResult = await c.query(
      `SELECT cs.id, cs.start_time, cs.capacity, cs.seats_booked,
              s.name AS service_name, st.name AS staff_name
       FROM class_sessions cs
       JOIN services s ON s.id = cs.service_id
       JOIN staff st ON st.id = cs.staff_id
       WHERE cs.start_time >= now()
       ORDER BY cs.start_time`
    );
    const classServicesResult = await c.query(
      `SELECT id, name FROM services WHERE capacity IS NOT NULL AND capacity >= 2 ORDER BY name`
    );
    const staffResult = await c.query(`SELECT id, name FROM staff ORDER BY name`);
    return { sessions: sessionsResult.rows, classServices: classServicesResult.rows, staff: staffResult.rows };
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Classes</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Scheduled sessions for your multi-seat services — customers book a seat, up to capacity.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {sessions.length === 0 && (
          <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-ink-muted">
            No upcoming sessions yet — schedule one below.
          </div>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-2xl border border-border bg-surface p-5"
          >
            <div>
              <div className="font-medium">{s.service_name}</div>
              <div className="mt-1 text-sm text-ink-muted">
                {formatTime(s.start_time)} · {s.staff_name}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-ink-secondary">
                {s.seats_booked} / {s.capacity} booked
              </div>
              <form action={deleteClassSession}>
                <input type="hidden" name="sessionId" value={s.id} />
                <button
                  type="submit"
                  className="rounded-full border border-border px-3 py-1.5 text-sm text-ink-secondary hover:bg-page"
                >
                  Remove
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-ink-secondary">Schedule a session</h2>
        <CreateSessionForm services={classServices} staff={staff} />
      </div>
    </div>
  );
}

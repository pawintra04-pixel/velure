import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { AddStaffForm } from "./AddStaffForm";
import { StaffCard, type Staff } from "./StaffCard";

export default async function StaffPage() {
  const owner = await requireOwner();

  const { staff, services } = await withBusinessContext(owner.businessId, async (c) => {
    // Two correlated subqueries rather than two LEFT JOINs off staff — joining
    // both staff_services (N services) and staff_hours (7 days) directly would
    // cross-product them (N x 7 rows per staff), duplicating both aggregates
    // by however many services/days the other one has.
    const staffResult = await c.query<Staff>(
      `SELECT st.id, st.name,
              (SELECT coalesce(array_agg(s.name), '{}')
               FROM staff_services ss JOIN services s ON s.id = ss.service_id
               WHERE ss.staff_id = st.id) AS service_names,
              (SELECT coalesce(
                 json_agg(
                   json_build_object(
                     'day_of_week', sh.day_of_week, 'is_off', sh.is_off,
                     'start_time', sh.start_time, 'end_time', sh.end_time,
                     'break_start', sh.break_start, 'break_end', sh.break_end
                   ) ORDER BY sh.day_of_week
                 ), '[]')
               FROM staff_hours sh WHERE sh.staff_id = st.id) AS hours
       FROM staff st
       ORDER BY st.created_at`
    );
    const servicesResult = await c.query(`SELECT id, name FROM services ORDER BY name`);
    return { staff: staffResult.rows, services: servicesResult.rows };
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Staff who can be booked for your services.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          {staff.length === 0 && (
            <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-ink-muted">
              No team members yet — add your first one below.
            </div>
          )}
          {staff.map((s) => (
            <StaffCard key={s.id} staff={s} />
          ))}
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-medium text-ink-secondary">Add a team member</h2>
          <AddStaffForm services={services} />
        </div>
    </div>
  );
}

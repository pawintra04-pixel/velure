import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { AddStaffForm } from "./AddStaffForm";
import { deleteStaff } from "./actions";

export default async function StaffPage() {
  const owner = await requireOwner();

  const { staff, services } = await withBusinessContext(owner.businessId, async (c) => {
    const staffResult = await c.query(
      `SELECT st.id, st.name,
              coalesce(array_agg(s.name) FILTER (WHERE s.id IS NOT NULL), '{}') AS service_names
       FROM staff st
       LEFT JOIN staff_services ss ON ss.staff_id = st.id
       LEFT JOIN services s ON s.id = ss.service_id
       GROUP BY st.id, st.name
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
            <div
              key={s.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-surface p-5"
            >
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="mt-1 text-sm text-ink-muted">
                  {s.service_names.length > 0 ? s.service_names.join(", ") : "No services assigned"}
                </div>
              </div>
              <form action={deleteStaff}>
                <input type="hidden" name="staffId" value={s.id} />
                <button
                  type="submit"
                  className="rounded-full border border-border px-3 py-1.5 text-sm text-ink-secondary hover:bg-page"
                >
                  Delete
                </button>
              </form>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-medium text-ink-secondary">Add a team member</h2>
          <AddStaffForm services={services} />
        </div>
    </div>
  );
}

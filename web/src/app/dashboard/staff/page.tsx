import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { AddStaffForm } from "./AddStaffForm";
import { StaffCard, type Staff } from "./StaffCard";
import { PageShell, PageHeader } from "@/components/dashboard/PageShell";
import { teamText } from "@/lib/i18n";

export default async function StaffPage() {
  const owner = await requireOwner();
  const locale = owner.locale;
  const t = teamText[locale];

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
               FROM staff_hours sh WHERE sh.staff_id = st.id) AS hours,
              (SELECT coalesce(
                 json_agg(
                   json_build_object(
                     'id', sb.id, 'start_time', sb.start_time, 'end_time', sb.end_time, 'reason', sb.reason
                   ) ORDER BY sb.start_time
                 ), '[]')
               FROM staff_blocks sb WHERE sb.staff_id = st.id AND sb.end_time >= now()) AS blocks
       FROM staff st
       ORDER BY st.created_at`
    );
    const servicesResult = await c.query(`SELECT id, name FROM services ORDER BY name`);
    return { staff: staffResult.rows, services: servicesResult.rows };
  });

  return (
    <PageShell width="standard">
        <div className="border-b border-border pb-5">
          <PageHeader
            title={t.title}
            description={t.description}
            actions={<AddStaffForm services={services} locale={locale} />}
          />
        </div>

        <div className="mt-6">
          {staff.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
              {t.noTeamYet}
            </div>
          ) : (
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              {staff.map((s) => (
                <StaffCard key={s.id} staff={s} locale={locale} />
              ))}
            </div>
          )}
        </div>
    </PageShell>
  );
}

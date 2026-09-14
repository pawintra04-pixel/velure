import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { AddServiceForm } from "./AddServiceForm";
import { ServiceCard, type Service } from "./ServiceCard";

export default async function ServicesPage() {
  const owner = await requireOwner();

  const services = await withBusinessContext(owner.businessId, async (c) => {
    const { rows } = await c.query<Service>(
      `SELECT s.id, s.name, s.duration_minutes, s.buffer_minutes, s.price_amount,
              s.payment_mode, s.deposit_amount, s.description, s.image_url,
              COALESCE(
                json_agg(
                  json_build_object('id', f.id, 'label', f.label, 'importance', f.importance)
                  ORDER BY f.sort_order
                ) FILTER (WHERE f.id IS NOT NULL),
                '[]'
              ) AS "customFields"
       FROM services s
       LEFT JOIN service_custom_fields f ON f.service_id = s.id
       GROUP BY s.id
       ORDER BY s.created_at`
    );
    return rows;
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Services</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          What customers can book on your public booking page.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          {services.length === 0 && (
            <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-ink-muted">
              No services yet — add your first one below.
            </div>
          )}
          {services.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-medium text-ink-secondary">Add a service</h2>
          <AddServiceForm />
        </div>
    </div>
  );
}

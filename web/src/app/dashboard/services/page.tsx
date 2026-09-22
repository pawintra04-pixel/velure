import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { AddServiceForm } from "./AddServiceForm";
import { ServiceCard, type Service } from "./ServiceCard";
import { PageShell, PageHeader } from "@/components/dashboard/PageShell";
import { servicesText } from "@/lib/i18n";

export default async function ServicesPage() {
  const owner = await requireOwner();
  const locale = owner.locale;
  const t = servicesText[locale];

  const services = await withBusinessContext(owner.businessId, async (c) => {
    // Two separate one-to-many children (custom fields, packages) — a
    // single LEFT JOIN across both would cartesian-product every field
    // against every package, so each is its own correlated subquery
    // instead of sharing one GROUP BY (that also avoids needing DISTINCT,
    // which would have silently broken custom fields' sort_order).
    const { rows } = await c.query<Service>(
      `SELECT s.id, s.name, s.duration_minutes, s.buffer_minutes, s.price_amount,
              s.payment_mode, s.deposit_amount, s.description, s.image_url, s.capacity,
              (SELECT COALESCE(json_agg(
                 json_build_object('id', f.id, 'label', f.label, 'importance', f.importance)
                 ORDER BY f.sort_order
               ), '[]')
               FROM service_custom_fields f WHERE f.service_id = s.id) AS "customFields",
              (SELECT COALESCE(json_agg(
                 json_build_object(
                   'id', pkg.id, 'name', pkg.name, 'sessionCount', pkg.session_count,
                   'priceAmount', pkg.price_amount, 'validityDays', pkg.validity_days
                 )
                 ORDER BY pkg.created_at
               ), '[]')
               FROM packages pkg WHERE pkg.service_id = s.id AND pkg.is_active) AS "packages"
       FROM services s
       ORDER BY s.created_at`
    );
    return rows;
  });

  return (
    <PageShell width="standard">
        <div className="border-b border-border pb-5">
          <PageHeader
            title={t.title}
            description={t.description}
            actions={<AddServiceForm locale={locale} />}
          />
        </div>

        <div className="mt-6">
          {services.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
              {t.noServicesYet}
            </div>
          ) : (
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              {services.map((s) => (
                <ServiceCard key={s.id} service={s} locale={locale} />
              ))}
            </div>
          )}
        </div>
    </PageShell>
  );
}

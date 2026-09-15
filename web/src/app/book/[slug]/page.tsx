import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/business";
import { withBusinessContext } from "@/db/client";
import { formatBaht } from "@/lib/money";
import { BookingHeader } from "@/components/booking/BookingHeader";

export default async function BookServicesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  const services = await withBusinessContext(business.id, async (c) => {
    const { rows } = await c.query(
      `SELECT id, name, duration_minutes, price_amount, payment_mode, deposit_amount, description, image_url
       FROM services ORDER BY name`
    );
    return rows;
  });

  return (
    <>
      <BookingHeader businessName={business.name} slug={slug} businessId={business.id} logoUrl={business.logo_url} />
      <div className="mx-auto max-w-5xl px-6 py-10 lg:px-10">
        <h1 className="text-2xl font-semibold">Choose a service</h1>
        {business.description && (
          <p className="mt-2 max-w-2xl text-sm text-ink-secondary">{business.description}</p>
        )}
        {(business.address || business.contact_phone || business.contact_email) && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
            {business.address && <span>{business.address}</span>}
            {business.contact_phone && <span>{business.contact_phone}</span>}
            {business.contact_email && <span>{business.contact_email}</span>}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.length === 0 && (
            <div className="text-sm text-ink-muted">No services available yet.</div>
          )}
          {services.map((s) => (
            <Link
              key={s.id}
              href={`/book/${slug}/${s.id}`}
              className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface hover:border-accent"
            >
              {s.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- owner-pasted external URL, not a static/optimizable asset
                <img src={s.image_url} alt="" className="h-36 w-full object-cover" />
              ) : (
                <div className="h-36 w-full bg-page" />
              )}
              <div className="flex flex-1 flex-col justify-between p-6">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="mt-1 text-sm text-ink-muted">{s.duration_minutes} min</div>
                  {s.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-ink-secondary">{s.description}</p>
                  )}
                </div>
                <div className="mt-3">
                  <div className="font-semibold">
                    {formatBaht(s.payment_mode === "deposit" ? s.deposit_amount : s.price_amount)}
                  </div>
                  {s.payment_mode === "deposit" && (
                    <div className="text-xs text-ink-muted">Deposit</div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

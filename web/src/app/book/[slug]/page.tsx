import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/business";
import { withBusinessContext } from "@/db/client";
import { formatBaht } from "@/lib/money";
import { effectiveDepositAmount } from "@/lib/deposit";
import { BookingHeader } from "@/components/booking/BookingHeader";
import { getVisitorLocale } from "@/lib/visitor-locale";
import { publicText, tMinutes, tPolicy } from "@/lib/i18n-public";

export default async function BookServicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ src?: string }>;
}) {
  const { slug } = await params;
  const { src } = await searchParams;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();
  const locale = await getVisitorLocale();
  const t = publicText[locale];

  const services = await withBusinessContext(business.id, async (c) => {
    const { rows } = await c.query(
      `SELECT id, name, duration_minutes, price_amount, payment_mode, deposit_amount, deposit_percent, description, image_url
       FROM services ORDER BY name`
    );
    return rows;
  });

  return (
    <>
      <BookingHeader businessName={business.name} slug={slug} businessId={business.id} logoUrl={business.logo_url} />
      <div className="mx-auto max-w-5xl px-6 py-10 lg:px-10">
        <h1 className="text-2xl font-semibold">{t.chooseService}</h1>
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

        {/* Shown before the customer picks a time or pays anything —
            the roadmap's own "Policies must be clearly shown BEFORE
            customer payment" requirement, previously not met at all. */}
        <p className="mt-3 max-w-2xl text-xs text-ink-muted">
          {tPolicy(locale, business.reschedule_cutoff_hours, business.cancel_cutoff_hours)} {t.depositNote}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.length === 0 && (
            <div className="text-sm text-ink-muted">{t.noServices}</div>
          )}
          {services.map((s) => (
            <Link
              key={s.id}
              href={src ? `/book/${slug}/${s.id}?src=${encodeURIComponent(src)}` : `/book/${slug}/${s.id}`}
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
                  <div className="mt-1 text-sm text-ink-muted">{tMinutes(locale, s.duration_minutes)}</div>
                  {s.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-ink-secondary">{s.description}</p>
                  )}
                </div>
                <div className="mt-3">
                  <div className="font-semibold">
                    {formatBaht(
                      s.payment_mode === "deposit"
                        ? effectiveDepositAmount({
                            priceAmount: s.price_amount,
                            depositAmount: s.deposit_amount,
                            depositPercent: s.deposit_percent,
                          })
                        : s.price_amount
                    )}
                  </div>
                  {s.payment_mode === "deposit" && (
                    <div className="text-xs text-ink-muted">
                      {t.deposit}
                      {s.deposit_percent != null ? ` (${s.deposit_percent}%)` : ""} — {t.fullPrice} {formatBaht(s.price_amount)}
                    </div>
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

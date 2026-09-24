import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/business";
import { withBusinessContext } from "@/db/client";
import { getAvailableSlots } from "@/lib/availability";
import { formatBaht } from "@/lib/money";
import { effectiveDepositAmount } from "@/lib/deposit";
import { BookingWizard } from "./BookingWizard";
import { ClassSessionPicker } from "./ClassSessionPicker";
import { BookingHeader } from "@/components/booking/BookingHeader";
import { getVisitorLocale } from "@/lib/visitor-locale";
import { publicText, tMinutes, tPolicy } from "@/lib/i18n-public";

function todayISOInBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

export default async function ServiceBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; serviceId: string }>;
  searchParams: Promise<{ src?: string }>;
}) {
  const { slug, serviceId } = await params;
  const { src } = await searchParams;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();
  const businessId = business.id;
  const locale = await getVisitorLocale();
  const t = publicText[locale];

  const service = await withBusinessContext(businessId, async (c) => {
    const { rows: [row] } = await c.query(
      `SELECT id, name, duration_minutes, price_amount, currency, payment_mode, deposit_amount, deposit_percent, description, image_url, capacity
       FROM services WHERE id = $1`,
      [serviceId]
    );
    return row ?? null;
  });

  if (!service) notFound();

  const isClass = Boolean(service.capacity && service.capacity >= 2);

  const today = todayISOInBangkok();
  const initialSlots = isClass ? [] : await getAvailableSlots(businessId, serviceId, today);

  const classSessions = isClass
    ? await withBusinessContext(businessId, async (c) => {
        const { rows } = await c.query(
          `SELECT cs.id, cs.start_time, cs.capacity, cs.seats_booked, st.name AS staff_name
           FROM class_sessions cs
           JOIN staff st ON st.id = cs.staff_id
           WHERE cs.service_id = $1 AND cs.start_time >= now()
           ORDER BY cs.start_time`,
          [serviceId]
        );
        return rows;
      })
    : [];

  return (
    <>
      <BookingHeader businessName={business.name} slug={slug} businessId={business.id} logoUrl={business.logo_url} />
      <div className="mx-auto max-w-5xl px-6 py-10 lg:px-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            {service.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- owner-pasted external URL, not a static/optimizable asset
              <img
                src={service.image_url}
                alt=""
                className="h-56 w-full rounded-2xl object-cover lg:h-72"
              />
            ) : null}
            <h1 className="mt-4 text-2xl font-semibold">{service.name}</h1>
            <p className="mt-1 text-sm text-ink-secondary">{tMinutes(locale, service.duration_minutes)}</p>
            {service.description && (
              <p className="mt-3 whitespace-pre-line text-sm text-ink-secondary">{service.description}</p>
            )}
            <div className="mt-4 rounded-xl border border-border p-3 text-sm text-ink-secondary">
              {service.payment_mode === "free" ? (
                <div>{t.freeNoPayment}</div>
              ) : service.payment_mode === "deposit" ? (
                <div>
                  {t.depositDueNow}:{" "}
                  <strong className="text-ink">
                    {formatBaht(
                      effectiveDepositAmount({
                        priceAmount: service.price_amount,
                        depositAmount: service.deposit_amount,
                        depositPercent: service.deposit_percent,
                      })
                    )}
                  </strong>
                  {service.deposit_percent != null ? ` (${service.deposit_percent}%)` : ""} {t.ofFullPrice}{" "}
                  {formatBaht(service.price_amount)}, {t.restOnArrival}
                </div>
              ) : (
                <div>{t.fullPaymentDueNow}: <strong className="text-ink">{formatBaht(service.price_amount)}</strong></div>
              )}
              <div className="mt-1 text-xs text-ink-muted">
                {tPolicy(locale, business.reschedule_cutoff_hours, business.cancel_cutoff_hours)}
              </div>
            </div>
          </div>

          {isClass ? (
            <ClassSessionPicker
              slug={slug}
              businessId={businessId}
              sessions={classSessions}
              source={src ?? null}
              locale={locale}
            />
          ) : (
            <BookingWizard
              slug={slug}
              businessId={businessId}
              serviceId={serviceId}
              initialDate={today}
              initialSlots={initialSlots}
              source={src ?? null}
              locale={locale}
            />
          )}
        </div>
      </div>
    </>
  );
}

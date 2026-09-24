import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/business";
import { withBusinessContext } from "@/db/client";
import { formatBaht } from "@/lib/money";
import { DetailsForm } from "./DetailsForm";
import { BookingHeader } from "@/components/booking/BookingHeader";
import { getVisitorLocale } from "@/lib/visitor-locale";
import type { Locale } from "@/lib/i18n";
import { publicText, intlLocale, tPolicyWithManage } from "@/lib/i18n-public";

function formatTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "Asia/Bangkok",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function BookingDetailsPage({
  params,
}: {
  params: Promise<{ slug: string; bookingId: string }>;
}) {
  const { slug, bookingId } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();
  const locale = await getVisitorLocale();
  const t = publicText[locale];

  const booking = await withBusinessContext(business.id, async (c) => {
    const { rows: [row] } = await c.query(
      `SELECT b.id, b.status, b.amount, b.start_time, b.hold_expires_at, b.service_id,
              s.name AS service_name, s.payment_mode, st.name AS staff_name
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN staff st ON st.id = b.staff_id
       WHERE b.id = $1`,
      [bookingId]
    );
    return row ?? null;
  });

  if (!booking) notFound();

  const paymentSettings = await withBusinessContext(business.id, async (c) => {
    const { rows: [row] } = await c.query(
      `SELECT stripe_account_id, accepts_card, accepts_promptpay, accepts_cash
       FROM businesses WHERE id = $1`,
      [business.id]
    );
    return row;
  });
  const availableMethods: ("card" | "promptpay" | "cash")[] = [
    ...(paymentSettings.stripe_account_id && paymentSettings.accepts_promptpay ? (["promptpay"] as const) : []),
    ...(paymentSettings.stripe_account_id && paymentSettings.accepts_card ? (["card"] as const) : []),
    ...(paymentSettings.accepts_cash ? (["cash"] as const) : []),
  ];

  const customFields = await withBusinessContext(business.id, async (c) => {
    const { rows } = await c.query(
      `SELECT id, label, importance FROM service_custom_fields
       WHERE service_id = $1 ORDER BY sort_order`,
      [booking.service_id]
    );
    return rows;
  });

  const expired =
    booking.status !== "TEMPORARY_HOLD" ||
    (booking.hold_expires_at && new Date(booking.hold_expires_at) < new Date());

  if (expired) {
    return (
      <>
        <BookingHeader businessName={business.name} slug={slug} businessId={business.id} logoUrl={business.logo_url} />
        <div className="mx-auto flex max-w-md flex-col items-center px-6 py-10 text-center">
          <h1 className="text-2xl font-semibold">{t.holdExpiredTitle}</h1>
          <p className="mt-2 text-sm text-ink-secondary">
            {t.holdExpiredDesc}
          </p>
          <Link
            href={`/book/${slug}/${booking.service_id}`}
            className="mt-6 rounded-xl bg-sunburst px-4 py-2.5 text-sm font-medium text-ink"
          >
            {t.chooseNewTime}
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <BookingHeader businessName={business.name} slug={slug} businessId={business.id} logoUrl={business.logo_url} />
      <div className="mx-auto max-w-4xl px-6 py-12 lg:px-10">
        <h1 className="text-2xl font-semibold">{t.almostDone}</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          {t.heldFor10}
        </p>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="flex h-fit flex-col gap-3 rounded-2xl border border-border bg-surface p-8 text-sm">
            <div className="flex justify-between gap-4 py-1.5">
              <span className="text-ink-muted">{t.service}</span>
              <span className="text-right">{booking.service_name}</span>
            </div>
            <div className="flex justify-between gap-4 py-1.5">
              <span className="text-ink-muted">{t.staff}</span>
              <span className="text-right">{booking.staff_name}</span>
            </div>
            <div className="flex justify-between gap-4 py-1.5">
              <span className="text-ink-muted">{t.time}</span>
              <span className="text-right">{formatTime(booking.start_time, locale)}</span>
            </div>
            {booking.amount > 0 && (
              <div className="flex justify-between gap-4 border-t border-border py-1.5 pt-4">
                <span className="text-ink-muted">
                  {booking.payment_mode === "deposit" ? t.depositDueNow : t.amountDue}
                </span>
                <span className="text-right font-medium">{formatBaht(booking.amount)}</span>
              </div>
            )}
            <p className="border-t border-border pt-3 text-xs text-ink-muted">
              {tPolicyWithManage(locale, business.reschedule_cutoff_hours, business.cancel_cutoff_hours)}
            </p>
          </div>

          <DetailsForm
            businessId={business.id}
            bookingId={bookingId}
            requiresPayment={booking.amount > 0}
            availableMethods={availableMethods}
            customFields={customFields}
            locale={locale}
          />
        </div>
      </div>
    </>
  );
}

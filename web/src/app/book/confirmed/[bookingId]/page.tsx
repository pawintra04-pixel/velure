import Link from "next/link";
import { notFound } from "next/navigation";
import { adminPool } from "@/db/client";
import { formatBaht } from "@/lib/money";
import { BookingHeader } from "@/components/booking/BookingHeader";
import { getVisitorLocale } from "@/lib/visitor-locale";
import { publicText, intlLocale, tStatus, tPayCashOnArrival } from "@/lib/i18n-public";

// Same adminPool-by-unguessable-id exception as the payment page/status route.
export default async function ConfirmedPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const locale = await getVisitorLocale();
  const t = publicText[locale];

  const { rows: [booking] } = await adminPool.query(
    `SELECT b.status, b.start_time, b.amount, b.payment_method, s.name AS service_name, st.name AS staff_name,
            biz.id AS business_id, biz.name AS business_name, biz.slug AS business_slug, biz.logo_url AS business_logo_url
     FROM bookings b
     JOIN services s ON s.id = b.service_id
     JOIN staff st ON st.id = b.staff_id
     JOIN businesses biz ON biz.id = b.business_id
     WHERE b.id = $1`,
    [bookingId]
  );

  if (!booking) notFound();

  const time = new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "Asia/Bangkok",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(booking.start_time));

  return (
    <>
      <BookingHeader businessName={booking.business_name} slug={booking.business_slug} businessId={booking.business_id} logoUrl={booking.business_logo_url} />
      <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-16 text-center">
        <div className="text-4xl">✅</div>
        <h1 className="mt-4 text-2xl font-semibold">
          {booking.status === "CONFIRMED" ? t.bookingConfirmed : `${t.status}: ${tStatus(locale, booking.status)}`}
        </h1>
        <div className="mt-6 w-full rounded-2xl border border-border bg-surface p-6 text-left text-sm">
          <div className="flex justify-between py-1">
            <span className="text-ink-muted">{t.service}</span>
            <span>{booking.service_name}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-ink-muted">{t.staff}</span>
            <span>{booking.staff_name}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-ink-muted">{t.time}</span>
            <span>{time}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-ink-muted">{booking.payment_method === "cash" ? t.amountDueCash : t.amountPaid}</span>
            <span>{formatBaht(booking.amount)}</span>
          </div>
        </div>

        {booking.payment_method === "cash" && booking.amount > 0 && (
          <div className="mt-4 w-full rounded-xl border border-[#fdf3e6] bg-[#fdf3e6] px-4 py-3 text-left text-sm text-[#a8681c]">
            {tPayCashOnArrival(locale, formatBaht(booking.amount))}
          </div>
        )}

        {booking.status === "CONFIRMED" && (
          <Link href={`/book/manage/${bookingId}`} className="mt-4 text-sm text-accent underline">
            {t.needReschedule}
          </Link>
        )}
        <Link href={`/book/${booking.business_slug}/signup`} className="mt-2 text-sm text-ink-muted underline">
          {t.createAccountCta}
        </Link>
      </div>
    </>
  );
}

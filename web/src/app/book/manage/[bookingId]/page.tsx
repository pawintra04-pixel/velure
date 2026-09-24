import { notFound } from "next/navigation";
import { adminPool } from "@/db/client";
import { formatBaht } from "@/lib/money";
import { ManageBookingClient } from "./ManageBookingClient";
import { BookingHeader } from "@/components/booking/BookingHeader";
import { getVisitorLocale } from "@/lib/visitor-locale";
import type { Locale } from "@/lib/i18n";
import { publicText, intlLocale, tStatus, tCannotChange } from "@/lib/i18n-public";

function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / (60 * 60 * 1000);
}

function formatTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "Asia/Bangkok",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(iso));
}

// Same adminPool-by-unguessable-id pattern as /book/pay and /book/confirmed:
// this page has no authenticated session (customers don't log in), so the
// booking id itself — random and unguessable — is what stands in for
// authorization here.
export default async function ManageBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ line?: string }>;
}) {
  const { bookingId } = await params;
  const { line } = await searchParams;
  const locale = await getVisitorLocale();
  const t = publicText[locale];

  const { rows: [booking] } = await adminPool.query(
    `SELECT b.id, b.status, b.amount, b.start_time, b.service_id, b.class_session_id,
            s.name AS service_name, st.name AS staff_name,
            biz.id AS business_id, biz.name AS business_name, biz.slug AS business_slug, biz.logo_url AS business_logo_url,
            biz.reschedule_cutoff_hours, biz.cancel_cutoff_hours,
            cu.line_user_id
     FROM bookings b
     JOIN services s ON s.id = b.service_id
     JOIN staff st ON st.id = b.staff_id
     JOIN businesses biz ON biz.id = b.business_id
     LEFT JOIN customers cu ON cu.id = b.customer_id
     WHERE b.id = $1`,
    [bookingId]
  );

  if (!booking) notFound();

  // Hidden entirely, not shown-disabled, when the business hasn't set up
  // LINE Login — this is a project-wide config, not a per-booking state.
  const lineConnectAvailable = Boolean(process.env.LINE_LOGIN_CHANNEL_ID);

  const hoursUntilStart = hoursUntil(booking.start_time);
  const canReschedule =
    !booking.class_session_id &&
    booking.status === "CONFIRMED" &&
    hoursUntilStart >= booking.reschedule_cutoff_hours;
  const canCancel = booking.status === "CONFIRMED" && hoursUntilStart >= booking.cancel_cutoff_hours;

  return (
    <>
      <BookingHeader businessName={booking.business_name} slug={booking.business_slug} businessId={booking.business_id} logoUrl={booking.business_logo_url} />
      <div className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-2xl font-semibold">{t.manageTitle}</h1>
        <p className="mt-1 text-sm text-ink-secondary">{booking.business_name}</p>

        <div className="mt-4 rounded-2xl border border-border bg-surface p-6 text-sm">
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
            <span>{formatTime(booking.start_time, locale)}</span>
          </div>
          {booking.amount > 0 && (
            <div className="flex justify-between py-1">
              <span className="text-ink-muted">{t.amount}</span>
              <span>{formatBaht(booking.amount)}</span>
            </div>
          )}
          <div className="flex justify-between py-1">
            <span className="text-ink-muted">{t.status}</span>
            <span>{tStatus(locale, booking.status)}</span>
          </div>
        </div>

        {booking.status === "CONFIRMED" ? (
          <ManageBookingClient
            bookingId={bookingId}
            serviceId={booking.service_id}
            serviceName={booking.service_name}
            startTimeLabel={formatTime(booking.start_time, locale)}
            amountLabel={booking.amount > 0 ? formatBaht(booking.amount) : null}
            canReschedule={canReschedule}
            canCancel={canCancel}
            rescheduleCutoffHours={booking.reschedule_cutoff_hours}
            cancelCutoffHours={booking.cancel_cutoff_hours}
            isClassBooking={Boolean(booking.class_session_id)}
            locale={locale}
          />
        ) : (
          <p className="mt-4 text-sm text-ink-muted">
            {tCannotChange(locale, booking.status)}
          </p>
        )}

        {lineConnectAvailable && (
          <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
            {line === "connected" || booking.line_user_id ? (
              <p className="text-sm text-ink-secondary">
                {t.lineConnected}
              </p>
            ) : (
              <>
                <p className="text-sm text-ink-secondary">{t.lineGetUpdates}</p>
                {line === "error" && (
                  <p className="mt-1 text-sm text-[#d03b3b]">
                    {t.lineError}
                  </p>
                )}
                <a
                  href={`/api/line/connect?bookingId=${bookingId}`}
                  className="mt-3 inline-block rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-page"
                >
                  {t.connectLine}
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

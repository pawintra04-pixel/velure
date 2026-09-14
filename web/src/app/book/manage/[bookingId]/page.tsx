import { notFound } from "next/navigation";
import { adminPool } from "@/db/client";
import { formatBaht } from "@/lib/money";
import { ManageBookingClient } from "./ManageBookingClient";
import { BookingHeader } from "@/components/booking/BookingHeader";

function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / (60 * 60 * 1000);
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
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
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;

  const { rows: [booking] } = await adminPool.query(
    `SELECT b.id, b.status, b.amount, b.start_time, b.service_id, b.class_session_id,
            s.name AS service_name, st.name AS staff_name,
            biz.name AS business_name, biz.slug AS business_slug, biz.logo_url AS business_logo_url,
            biz.reschedule_cutoff_hours, biz.cancel_cutoff_hours
     FROM bookings b
     JOIN services s ON s.id = b.service_id
     JOIN staff st ON st.id = b.staff_id
     JOIN businesses biz ON biz.id = b.business_id
     WHERE b.id = $1`,
    [bookingId]
  );

  if (!booking) notFound();

  const hoursUntilStart = hoursUntil(booking.start_time);
  const canReschedule =
    !booking.class_session_id &&
    booking.status === "CONFIRMED" &&
    hoursUntilStart >= booking.reschedule_cutoff_hours;
  const canCancel = booking.status === "CONFIRMED" && hoursUntilStart >= booking.cancel_cutoff_hours;

  return (
    <>
      <BookingHeader businessName={booking.business_name} slug={booking.business_slug} logoUrl={booking.business_logo_url} />
      <div className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-2xl font-semibold">Manage your booking</h1>
        <p className="mt-1 text-sm text-ink-secondary">{booking.business_name}</p>

        <div className="mt-4 rounded-2xl border border-border bg-surface p-6 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-ink-muted">Service</span>
            <span>{booking.service_name}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-ink-muted">Staff</span>
            <span>{booking.staff_name}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-ink-muted">Time</span>
            <span>{formatTime(booking.start_time)}</span>
          </div>
          {booking.amount > 0 && (
            <div className="flex justify-between py-1">
              <span className="text-ink-muted">Amount</span>
              <span>{formatBaht(booking.amount)}</span>
            </div>
          )}
          <div className="flex justify-between py-1">
            <span className="text-ink-muted">Status</span>
            <span>{booking.status.replace("_", " ")}</span>
          </div>
        </div>

        {booking.status === "CONFIRMED" ? (
          <ManageBookingClient
            bookingId={bookingId}
            serviceId={booking.service_id}
            canReschedule={canReschedule}
            canCancel={canCancel}
            rescheduleCutoffHours={booking.reschedule_cutoff_hours}
            cancelCutoffHours={booking.cancel_cutoff_hours}
            isClassBooking={Boolean(booking.class_session_id)}
          />
        ) : (
          <p className="mt-4 text-sm text-ink-muted">
            This booking is {booking.status.toLowerCase().replace("_", " ")} and can no longer be
            changed here.
          </p>
        )}
      </div>
    </>
  );
}

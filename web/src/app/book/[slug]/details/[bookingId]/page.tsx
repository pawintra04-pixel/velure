import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/business";
import { withBusinessContext } from "@/db/client";
import { formatBaht } from "@/lib/money";
import { DetailsForm } from "./DetailsForm";
import { BookingHeader } from "@/components/booking/BookingHeader";

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
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

  const booking = await withBusinessContext(business.id, async (c) => {
    const { rows: [row] } = await c.query(
      `SELECT b.id, b.status, b.amount, b.start_time, b.hold_expires_at, b.service_id,
              s.name AS service_name, st.name AS staff_name
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN staff st ON st.id = b.staff_id
       WHERE b.id = $1`,
      [bookingId]
    );
    return row ?? null;
  });

  if (!booking) notFound();

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
        <BookingHeader businessName={business.name} slug={slug} />
        <div className="mx-auto flex max-w-md flex-col items-center px-6 py-10 text-center">
          <h1 className="text-2xl font-semibold">This hold has expired</h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Reservations are held for 10 minutes. Please pick a new time.
          </p>
          <Link
            href={`/book/${slug}/${booking.service_id}`}
            className="mt-6 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink"
          >
            Choose a new time
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <BookingHeader businessName={business.name} slug={slug} />
      <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
        <h1 className="text-2xl font-semibold">Almost done</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Your slot is reserved for 10 minutes — complete your details to confirm it.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="h-fit rounded-2xl border border-border bg-surface p-5 text-sm">
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
                <span className="text-ink-muted">Amount due</span>
                <span>{formatBaht(booking.amount)}</span>
              </div>
            )}
          </div>

          <DetailsForm
            businessId={business.id}
            bookingId={bookingId}
            requiresPayment={booking.amount > 0}
            customFields={customFields}
          />
        </div>
      </div>
    </>
  );
}

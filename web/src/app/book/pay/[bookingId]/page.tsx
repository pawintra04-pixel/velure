import { notFound, redirect } from "next/navigation";
import { adminPool } from "@/db/client";
import { stripe } from "@/lib/stripe";
import { formatBaht } from "@/lib/money";
import { PaymentStatusPoller } from "./PaymentStatusPoller";

// Uses adminPool directly, not withBusinessContext: this page is reached by
// an unguessable booking id (UUID) before we know which business it belongs
// to — the same legitimate admin-lookup case as the Stripe webhook handler
// (see db/client.ts's doc comment on adminPool). No business-scoped listing
// or enumeration happens here, only a single row fetched by primary key.
export default async function PaymentPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;

  const { rows: [booking] } = await adminPool.query(
    `SELECT b.id, b.status, b.amount, b.stripe_payment_intent_id, biz.stripe_account_id
     FROM bookings b
     JOIN businesses biz ON biz.id = b.business_id
     WHERE b.id = $1`,
    [bookingId]
  );

  if (!booking) notFound();
  if (booking.status === "CONFIRMED") redirect(`/book/confirmed/${bookingId}`);
  if (!booking.stripe_payment_intent_id || !booking.stripe_account_id) notFound();

  const paymentIntent = await stripe.paymentIntents.retrieve(
    booking.stripe_payment_intent_id,
    {},
    { stripeAccount: booking.stripe_account_id }
  );
  const qrAction = paymentIntent.next_action?.promptpay_display_qr_code;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-10 text-center">
      <h1 className="text-2xl font-semibold">Scan to pay</h1>
      <p className="mt-1 text-sm text-ink-secondary">Amount due {formatBaht(booking.amount)}</p>

      {qrAction?.image_url_png ? (
        <img
          src={qrAction.image_url_png}
          alt="PromptPay QR code"
          className="mt-6 h-64 w-64 rounded-2xl border border-border"
        />
      ) : (
        <div className="mt-6 text-sm text-ink-muted">QR code not found — please try again</div>
      )}

      {qrAction?.hosted_instructions_url && (
        <a
          href={qrAction.hosted_instructions_url}
          target="_blank"
          className="mt-4 text-sm text-accent underline"
        >
          Open payment page (test mode)
        </a>
      )}

      <PaymentStatusPoller bookingId={bookingId} />
    </div>
  );
}

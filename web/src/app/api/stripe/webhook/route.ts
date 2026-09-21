import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminPool } from "@/db/client";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { sendLineBookingConfirmation } from "@/lib/line";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// adminPool throughout: a webhook arrives with no authenticated business
// context (that's the whole point of this exception in db/client.ts) — the
// business is identified indirectly, via the booking row the payment_intent
// id points to.
export async function POST(req: Request) {
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature ?? "", webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  // Idempotency per spikes/stripe-connect-promptpay: key on event.id (a
  // single payment fires multiple event types at this same endpoint), via a
  // dedicated table rather than a status check, so out-of-order delivery
  // can't misfire — see db/migrations/008_stripe_events.sql.
  const { rows: inserted } = await adminPool.query(
    `INSERT INTO processed_stripe_events (event_id, event_type) VALUES ($1, $2)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
    [event.id, event.type]
  );
  if (inserted.length === 0) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as { id: string };
    // Only a genuine pending -> confirmed transition, never a blanket
    // "!= CONFIRMED" — an out-of-order/retried "succeeded" event arriving
    // after the owner already refunded or cancelled this booking must not
    // resurrect it back to CONFIRMED. TEMPORARY_HOLD/PAYMENT_PENDING are
    // the only states a real payment success can legitimately follow.
    const { rows: [confirmed] } = await adminPool.query(
      `UPDATE bookings SET status = 'CONFIRMED'
       WHERE stripe_payment_intent_id = $1 AND status IN ('TEMPORARY_HOLD', 'PAYMENT_PENDING')
       RETURNING id`,
      [paymentIntent.id]
    );
    // Only when THIS call is what actually flipped it — not on a webhook
    // that arrives after the booking was already confirmed, which would
    // otherwise send a duplicate email even though processed_stripe_events
    // already dedupes by event.id (a different event.id for the same
    // payment could still reach here, e.g. a retried/out-of-order delivery).
    if (confirmed) {
      await sendBookingConfirmationEmail(confirmed.id);
      await sendLineBookingConfirmation(confirmed.id);
    }
  } else if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object as { id: string };
    // Same reasoning as above, mirrored: a failed event must only move a
    // still-pending booking to PAYMENT_FAILED, never regress a booking
    // that has already resolved (confirmed, completed, cancelled, or
    // refunded) via a later event.
    await adminPool.query(
      `UPDATE bookings SET status = 'PAYMENT_FAILED'
       WHERE stripe_payment_intent_id = $1 AND status IN ('TEMPORARY_HOLD', 'PAYMENT_PENDING')`,
      [paymentIntent.id]
    );
  }

  return NextResponse.json({ received: true });
}

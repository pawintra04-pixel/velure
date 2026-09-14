import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminPool } from "@/db/client";

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
    await adminPool.query(
      `UPDATE bookings SET status = 'CONFIRMED'
       WHERE stripe_payment_intent_id = $1 AND status != 'CONFIRMED'`,
      [paymentIntent.id]
    );
  } else if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object as { id: string };
    await adminPool.query(
      `UPDATE bookings SET status = 'PAYMENT_FAILED'
       WHERE stripe_payment_intent_id = $1 AND status NOT IN ('CONFIRMED', 'COMPLETED')`,
      [paymentIntent.id]
    );
  }

  return NextResponse.json({ received: true });
}

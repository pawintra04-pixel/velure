import express from "express";
import Stripe from "stripe";
import { writeFileSync } from "node:fs";

const secretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!secretKey || !webhookSecret) {
  console.error("Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET (from `stripe listen`).");
  process.exit(1);
}

const stripe = new Stripe(secretKey);
const app = express();

// In-memory "booking" state, keyed by payment_intent id — stands in for the
// real bookings table. What matters for this spike is the state transition
// and the idempotency guard, not persistence.
type Booking = { status: "PAYMENT_PENDING" | "CONFIRMED"; confirmedCount: number };
const bookings = new Map<string, Booking>();
const processedEventIds = new Set<string>();

app.post("/create-booking-hold", express.json(), (req, res) => {
  const { paymentIntentId } = req.body;
  bookings.set(paymentIntentId, { status: "PAYMENT_PENDING", confirmedCount: 0 });
  console.log(`[booking] ${paymentIntentId} -> PAYMENT_PENDING`);
  res.json({ ok: true });
});

app.get("/booking/:paymentIntentId", (req, res) => {
  const booking = bookings.get(req.params.paymentIntentId);
  res.json(booking ?? null);
});

// Raw body is required for Stripe signature verification — must come before any
// JSON body parser on this route.
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"] as string,
      webhookSecret!
    );
  } catch (err: any) {
    console.error("Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Saved so a separate script can replay the exact same signed payload later,
  // to prove duplicate delivery doesn't double-confirm a booking.
  writeFileSync(
    ".last-webhook.json",
    JSON.stringify({
      rawBody: req.body.toString(),
      signature: req.headers["stripe-signature"],
    })
  );

  // Idempotency guard: Stripe's own event id, not just the payment_intent id,
  // because retries of the SAME event resend the same event id.
  if (processedEventIds.has(event.id)) {
    console.log(`[webhook] DUPLICATE event ${event.id} (${event.type}) — already processed, skipping side effect`);
    return res.json({ received: true, duplicate: true });
  }
  processedEventIds.add(event.id);

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const booking = bookings.get(pi.id);
    if (booking) {
      booking.status = "CONFIRMED";
      booking.confirmedCount += 1;
      console.log(`[booking] ${pi.id} -> CONFIRMED (confirm side-effect run #${booking.confirmedCount})`);
    } else {
      console.log(`[webhook] payment_intent.succeeded for unknown booking ${pi.id}`);
    }
  }

  res.json({ received: true });
});

const port = 4242;
app.listen(port, () => console.log(`Webhook receiver listening on :${port}`));

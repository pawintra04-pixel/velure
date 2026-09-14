import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set — see spikes/stripe-connect-promptpay/NOTES.md");
}
if (!secretKey.startsWith("sk_test_")) {
  throw new Error("Refusing to run against a non-test Stripe key.");
}

export const stripe = new Stripe(secretKey);

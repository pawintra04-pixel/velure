"use client";

import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

export function CardPaymentForm({
  clientSecret,
  stripeAccountId,
  bookingId,
}: {
  clientSecret: string;
  stripeAccountId: string;
  bookingId: string;
}) {
  // useMemo, not module-level: this page can serve different businesses
  // (different connected accounts) across loads, and loadStripe's second
  // argument fixes the account for that Stripe.js instance — a single
  // cached module-level promise would leak the first business's account
  // into every other business's checkout.
  const stripePromise = useMemo(() => {
    const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!pk) {
      console.error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set");
      return null;
    }
    return loadStripe(pk, { stripeAccount: stripeAccountId });
  }, [stripeAccountId]);

  if (!stripePromise) {
    return <div className="mt-6 text-sm text-[#d03b3b]">Card payments are not configured.</div>;
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CardForm bookingId={bookingId} />
    </Elements>
  );
}

function CardForm({ bookingId }: { bookingId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/book/confirmed/${bookingId}`,
      },
    });

    // Only reached if confirmation fails synchronously (e.g. validation) —
    // on success Stripe redirects the browser to return_url itself.
    if (confirmError) {
      setError(confirmError.message ?? "Payment failed. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex w-full max-w-sm flex-col gap-4">
      <PaymentElement />
      {error && <div className="text-sm text-[#d03b3b]">{error}</div>}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="rounded-xl bg-sunburst py-2.5 text-sm font-medium text-ink disabled:opacity-50"
      >
        {submitting ? "Processing..." : "Pay now"}
      </button>
    </form>
  );
}

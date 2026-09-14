"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeBookingDetails } from "../../../actions";

export function DetailsForm({
  businessId,
  bookingId,
  requiresPayment,
}: {
  businessId: string;
  bookingId: string;
  requiresPayment: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"promptpay" | "card">("promptpay");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await completeBookingDetails({
        businessId,
        bookingId,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        paymentMethod,
      });

      if (!result.ok) {
        if (result.reason === "hold_expired") {
          setError("Your reservation expired while filling this in. Please pick a new time.");
        } else {
          setError("Something went wrong. Please try again.");
        }
        return;
      }

      router.push(
        result.needsPayment ? `/book/pay/${result.bookingId}` : `/book/confirmed/${result.bookingId}`
      );
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
      <div className="text-sm text-ink-secondary">Your details</div>
      <input
        className="rounded-lg border border-border px-3 py-2 text-sm"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="rounded-lg border border-border px-3 py-2 text-sm"
        placeholder="Phone number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <input
        className="rounded-lg border border-border px-3 py-2 text-sm"
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {requiresPayment && (
        <div>
          <div className="text-sm text-ink-secondary">Pay with</div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod("promptpay")}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm ${
                paymentMethod === "promptpay"
                  ? "border-accent bg-accent/10 font-medium"
                  : "border-border text-ink-secondary"
              }`}
            >
              PromptPay
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("card")}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm ${
                paymentMethod === "card"
                  ? "border-accent bg-accent/10 font-medium"
                  : "border-border text-ink-secondary"
              }`}
            >
              Card
            </button>
          </div>
        </div>
      )}

      {error && <div className="text-sm text-[#d03b3b]">{error}</div>}
      <button
        onClick={submit}
        disabled={isPending || !name.trim() || !phone.trim() || !email.trim()}
        className="rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {isPending ? "Processing..." : requiresPayment ? "Continue to payment" : "Confirm booking"}
      </button>
    </div>
  );
}

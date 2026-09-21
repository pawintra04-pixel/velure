"use client";

import { useState, useTransition } from "react";
import { refundBooking } from "./actions";
import { formatBaht } from "@/lib/money";
import type { CalendarBooking } from "@/lib/bookings-data";
import { formatTime } from "./BookingRow";

// Refund is financially consequential, so this is a real two-step flow —
// choose an amount, then an explicit confirmation naming the customer,
// booking, and exact amount before anything reaches Stripe — not a single
// click. Success is only ever shown after Stripe/the server actually
// confirms it (refundBooking's own ok/error result), never assumed.
export function RefundButton({ bookingId, b }: { bookingId: string; b: CalendarBooking }) {
  const [step, setStep] = useState<"closed" | "amount" | "confirm">("closed");
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amountBaht, setAmountBaht] = useState(String(b.amount / 100));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refundAmountBaht = mode === "full" ? b.amount / 100 : Number(amountBaht);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await refundBooking(bookingId, mode === "full" ? null : Number(amountBaht));
      if (!result.ok) {
        setError(result.error);
        setStep("confirm");
        return;
      }
      setSuccess(result.message ?? "Refund issued");
      setStep("closed");
    });
  }

  if (step === "closed") {
    return (
      <div>
        <button
          onClick={() => {
            setSuccess(null);
            setStep("amount");
          }}
          className="rounded-full border border-border px-3 py-2 text-xs hover:bg-page"
        >
          Refund
        </button>
        {success && <div className="mt-1 text-xs text-[#1b8a5a]">✓ {success}</div>}
      </div>
    );
  }

  if (step === "amount") {
    return (
      <div className="flex w-full flex-col gap-2 rounded-xl border border-border bg-page p-3 text-xs">
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={mode === "full"} onChange={() => setMode("full")} />
            Full ({formatBaht(b.amount)})
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={mode === "partial"} onChange={() => setMode("partial")} />
            Partial
          </label>
          {mode === "partial" && (
            <input
              type="number"
              min={0}
              max={b.amount / 100}
              step="0.01"
              value={amountBaht}
              onChange={(e) => setAmountBaht(e.target.value)}
              className="w-24 rounded-lg border border-border px-2 py-1 text-xs"
            />
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setStep("confirm")}
            disabled={!Number.isFinite(refundAmountBaht) || refundAmountBaht <= 0}
            className="rounded-full bg-sunburst px-3 py-1.5 font-medium text-ink disabled:opacity-50"
          >
            Continue
          </button>
          <button onClick={() => setStep("closed")} className="rounded-full border border-border px-3 py-1.5">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // step === "confirm"
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={() => !isPending && setStep("amount")}
    >
      <div className="w-full max-w-sm rounded-2xl bg-surface p-5 text-sm" onClick={(e) => e.stopPropagation()}>
        <div className="text-[15px] text-ink">Refund {formatBaht(Math.round(refundAmountBaht * 100))}?</div>
        <div className="mt-3 rounded-lg bg-page px-3 py-2 text-ink">
          <div>{b.customerName ?? "Unnamed customer"}</div>
          <div className="text-ink-secondary">{b.serviceName}</div>
          <div className="text-ink-secondary">{formatTime(b.startTime)}</div>
          <div className="text-ink-secondary">
            {formatBaht(b.amount)} paid · refunding {formatBaht(Math.round(refundAmountBaht * 100))}
          </div>
        </div>
        <p className="mt-3 text-ink-secondary">
          This sends money back to the customer&rsquo;s original payment method through Stripe.
          It cannot be undone from Velure.
        </p>
        {error && <div className="mt-2 text-[#d03b3b]">{error}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setStep("amount")}
            disabled={isPending}
            className="rounded-full border border-border px-4 py-2 text-sm hover:bg-page disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="rounded-full bg-[#d03b3b] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Refunding…" : "Confirm refund"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { refundBooking } from "./actions";
import { formatBaht } from "@/lib/money";
import type { CalendarBooking } from "@/lib/bookings-data";
import { formatTime } from "./BookingRow";
import { bookingsText, tRefundQuestion, tFullAmount, tPaidRefunding, type Locale } from "@/lib/i18n";

export type RefundKind = "stripe" | "package" | "cash";

// Refund is financially consequential, so this is a real two-step flow —
// choose an amount, then an explicit confirmation naming the customer,
// booking, and exact amount before anything reaches Stripe — not a single
// click. Success is only ever shown after Stripe/the server actually
// confirms it (refundBooking's own ok/error result), never assumed.
//
// `kind` only changes copy and whether the amount step exists — the actual
// branch (Stripe call / package restore / plain status update) is decided
// server-side in refundBooking from the booking's own data, never trusted
// from here. "package" skips the amount step entirely: a redeemed session
// is a single unit, not a partial amount, so there's nothing to choose.
export function RefundButton({
  bookingId,
  b,
  locale,
  kind,
}: {
  bookingId: string;
  b: CalendarBooking;
  locale: Locale;
  kind: RefundKind;
}) {
  const t = bookingsText[locale];
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
      const result = await refundBooking(bookingId, kind === "package" || mode === "full" ? null : Number(amountBaht));
      if (!result.ok) {
        setError(result.error);
        setStep("confirm");
        return;
      }
      setSuccess(result.message ?? (kind === "package" ? "Package session restored" : "Refund issued"));
      setStep("closed");
    });
  }

  if (step === "closed") {
    return (
      <div>
        <button
          onClick={() => {
            setSuccess(null);
            // Package restores have nothing to choose an amount for — go
            // straight to the confirmation step.
            setStep(kind === "package" ? "confirm" : "amount");
          }}
          className="rounded-full border border-border px-3 py-2 text-xs hover:bg-page"
        >
          {kind === "package" ? t.restoreSession : t.refund}
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
            {tFullAmount(locale, formatBaht(b.amount))}
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={mode === "partial"} onChange={() => setMode("partial")} />
            {t.partial}
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
            {t.continue}
          </button>
          <button onClick={() => setStep("closed")} className="rounded-full border border-border px-3 py-1.5">
            {t.cancel}
          </button>
        </div>
      </div>
    );
  }

  // step === "confirm"
  const backStep = kind === "package" ? "closed" : "amount";
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={() => !isPending && setStep(backStep)}
    >
      <div className="w-full max-w-sm rounded-2xl bg-surface p-5 text-sm" onClick={(e) => e.stopPropagation()}>
        <div className="text-[15px] text-ink">
          {kind === "package" ? t.restoreQuestion : tRefundQuestion(locale, formatBaht(Math.round(refundAmountBaht * 100)))}
        </div>
        <div className="mt-3 rounded-lg bg-page px-3 py-2 text-ink">
          <div>{b.customerName ?? t.unnamedCustomer}</div>
          <div className="text-ink-secondary">{b.serviceName}</div>
          <div className="text-ink-secondary">{formatTime(b.startTime)}</div>
          {kind !== "package" && (
            <div className="text-ink-secondary">
              {tPaidRefunding(locale, formatBaht(b.amount), formatBaht(Math.round(refundAmountBaht * 100)))}
            </div>
          )}
        </div>
        <p className="mt-3 text-ink-secondary">
          {kind === "package" ? t.restoreNotice : kind === "cash" ? t.cashRefundNotice : t.refundNotice}
        </p>
        {error && <div className="mt-2 text-[#d03b3b]">{error}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setStep(backStep)}
            disabled={isPending}
            className="rounded-full border border-border px-4 py-2 text-sm hover:bg-page disabled:opacity-50"
          >
            {t.back}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="rounded-full bg-[#d03b3b] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending
              ? kind === "package"
                ? t.restoring
                : t.refunding
              : kind === "package"
                ? t.confirmRestore
                : t.confirmRefund}
          </button>
        </div>
      </div>
    </div>
  );
}

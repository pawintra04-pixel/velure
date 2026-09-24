"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { createManualBooking, type ManualBookingResult } from "./actions";
import { bookingsText, type Locale } from "@/lib/i18n";

type Option = { id: string; name: string };

export function NewBookingForm({
  services,
  staff,
  locale,
  buttonClassName,
}: {
  services: Option[];
  staff: Option[];
  locale: Locale;
  /** Overrides the trigger button's look only — the form/action underneath is unchanged. */
  buttonClassName?: string;
}) {
  const t = bookingsText[locale];
  const [open, setOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "unpaid" | "deposit" | "free">("unpaid");
  const PAYMENT_LABEL = { paid: t.payPaid, unpaid: t.payUnpaid, deposit: t.payDeposit, free: t.payFree };
  const [state, formAction, pending] = useActionState<ManualBookingResult | null, FormData>(
    createManualBooking,
    null
  );

  // Close the drawer once a booking is actually created — adjusted during
  // render against the previous `state` reference (same pattern
  // ConfirmSubmitButton uses), not an effect, so a stale `open` can't
  // survive past a successful submit. An error leaves the drawer open with
  // the message visible, so the fields and the mistake stay in view together.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.ok) {
      setOpen(false);
      setPaymentStatus("unpaid");
    }
  }

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName ?? "rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-page"}
      >
        + {t.newBooking}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 animate-[drawer-backdrop-in_0.15s_ease-out] bg-midnight/40"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="New booking"
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-y-0 right-0 flex w-full animate-[drawer-slide-in_0.2s_ease-out] flex-col bg-surface shadow-xl sm:w-[420px]"
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-[17px] text-ink">{t.newBooking}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-ink-muted hover:bg-page hover:text-ink"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
                  <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* onSubmit instead of action={formAction}: React 19 auto-resets a
                form after its action runs — including on an error — which
                wiped every field the owner typed and desynced the payment
                radios. Dispatching manually keeps the fields on error. */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                startTransition(() => formAction(data));
              }}
              className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-5"
            >
              <div className="text-sm font-medium text-ink-secondary">{t.forPhoneEtc}</div>

              <select name="serviceId" className="rounded-lg border border-border px-3 py-2 text-sm">
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select name="staffId" className="rounded-lg border border-border px-3 py-2 text-sm">
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-3">
                <input type="date" name="date" className="rounded-lg border border-border px-3 py-2 text-sm" />
                <input type="time" name="time" className="rounded-lg border border-border px-3 py-2 text-sm" />
              </div>

              <input
                name="customerName"
                placeholder={t.customerName}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              />
              <input
                name="customerPhone"
                placeholder={t.phoneNumber}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              />
              <input
                name="customerEmail"
                type="email"
                placeholder={t.emailOptional}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              />
              <fieldset className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5">
                <legend className="px-1 text-sm font-medium text-ink-secondary">{t.paymentLabel}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(["paid", "unpaid", "deposit", "free"] as const).map((v) => (
                    <label key={v} className="flex items-center gap-2 text-sm text-ink-secondary">
                      <input
                        type="radio"
                        name="paymentStatus"
                        value={v}
                        checked={paymentStatus === v}
                        onChange={() => setPaymentStatus(v)}
                      />
                      {PAYMENT_LABEL[v]}
                    </label>
                  ))}
                </div>
                {paymentStatus === "deposit" && (
                  <input
                    name="depositPaidBaht"
                    type="number"
                    min="1"
                    step="any"
                    inputMode="decimal"
                    placeholder={t.depositAmountPlaceholder}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  />
                )}
                <input
                  name="paymentNote"
                  maxLength={200}
                  placeholder={t.paymentNotePlaceholder}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                />
              </fieldset>

              {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}

              <button
                type="submit"
                disabled={pending || services.length === 0 || staff.length === 0}
                className="mt-1 self-start rounded-xl bg-sunburst px-4 py-2.5 text-sm font-medium text-ink transition-[filter] hover:brightness-95 disabled:opacity-50"
              >
                {pending ? t.creating : t.createBooking}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

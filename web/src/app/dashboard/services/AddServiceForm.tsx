"use client";

import { useActionState, useState } from "react";
import { addService, type ActionResult } from "./actions";
import { servicesText, type Locale } from "@/lib/i18n";

export function AddServiceForm({ locale }: { locale: Locale }) {
  const t = servicesText[locale];
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    addService,
    null
  );
  const [paymentMode, setPaymentMode] = useState("full");
  const [depositKind, setDepositKind] = useState<"fixed" | "percent">("fixed");

  // Close the form once a submission succeeds — adjusted during render
  // (comparing against the previous state), not in an effect, matching the
  // pattern Sidebar.tsx already uses for this same "react to a prop/state
  // change" case.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.ok) setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-sunburst px-4 py-2 text-sm font-medium text-ink transition-[filter] hover:brightness-95"
      >
        {t.addService}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5"
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-ink-secondary">{t.addServiceTitle}</div>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-muted hover:text-ink-secondary">
          {t.close}
        </button>
      </div>
      <input
        name="name"
        placeholder={t.serviceName}
        className="rounded-lg border border-border px-3 py-2 text-sm"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="durationMinutes"
          type="number"
          min={1}
          placeholder={t.durationMin}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <input
          name="bufferMinutes"
          type="number"
          min={0}
          placeholder={t.bufferMin}
          defaultValue={0}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="priceBaht"
          type="number"
          min={0}
          step="0.01"
          placeholder={t.priceThb}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <select
          name="paymentMode"
          value={paymentMode}
          onChange={(e) => setPaymentMode(e.target.value)}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        >
          <option value="full">{t.fullPayment}</option>
          <option value="deposit">{t.deposit}</option>
          <option value="free">{t.free}</option>
        </select>
      </div>
      {paymentMode === "deposit" && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={depositKind === "fixed"} onChange={() => setDepositKind("fixed")} />
              {t.depositFixed}
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={depositKind === "percent"} onChange={() => setDepositKind("percent")} />
              {t.depositPercentOption}
            </label>
          </div>
          <input type="hidden" name="depositKind" value={depositKind} />
          {depositKind === "fixed" ? (
            <input
              name="depositBaht"
              type="number"
              min={0}
              step="0.01"
              placeholder={t.depositAmountThb}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            />
          ) : (
            <input
              name="depositPercent"
              type="number"
              min={1}
              max={100}
              step={1}
              placeholder={t.depositPercentPlaceholder}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            />
          )}
        </div>
      )}
      <label className="text-sm text-ink-secondary">
        {t.capacitySeatsLabel}
        <input
          name="capacity"
          type="number"
          min={2}
          step={1}
          placeholder={t.capacityPlaceholder}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </label>
      {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-sunburst py-2.5 text-sm font-medium text-ink disabled:opacity-50"
      >
        {pending ? t.adding : t.addServiceButton}
      </button>
    </form>
  );
}

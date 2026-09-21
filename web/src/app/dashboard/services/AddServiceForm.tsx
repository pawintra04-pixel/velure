"use client";

import { useActionState, useState } from "react";
import { addService, type ActionResult } from "./actions";

export function AddServiceForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    addService,
    null
  );
  const [paymentMode, setPaymentMode] = useState("full");

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
        + Add service
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5"
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-ink-secondary">Add a service</div>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-muted hover:text-ink-secondary">
          Close
        </button>
      </div>
      <input
        name="name"
        placeholder="Service name"
        className="rounded-lg border border-border px-3 py-2 text-sm"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="durationMinutes"
          type="number"
          min={1}
          placeholder="Duration (min)"
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <input
          name="bufferMinutes"
          type="number"
          min={0}
          placeholder="Buffer (min)"
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
          placeholder="Price (THB)"
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <select
          name="paymentMode"
          value={paymentMode}
          onChange={(e) => setPaymentMode(e.target.value)}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        >
          <option value="full">Full payment</option>
          <option value="deposit">Deposit</option>
          <option value="free">Free</option>
        </select>
      </div>
      {paymentMode === "deposit" && (
        <input
          name="depositBaht"
          type="number"
          min={0}
          step="0.01"
          placeholder="Deposit amount (THB)"
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
      )}
      <label className="text-sm text-ink-secondary">
        Capacity (seats) — leave blank for a regular 1:1 service
        <input
          name="capacity"
          type="number"
          min={2}
          step={1}
          placeholder="e.g. 10 for a class"
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </label>
      {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-sunburst py-2.5 text-sm font-medium text-ink disabled:opacity-50"
      >
        {pending ? "Adding..." : "Add service"}
      </button>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { addService, type ActionResult } from "./actions";

export function AddServiceForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    addService,
    null
  );
  const [paymentMode, setPaymentMode] = useState("full");

  return (
    <form
      action={formAction}
      className="mt-3 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5"
    >
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
        className="rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Adding..." : "Add service"}
      </button>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { createManualBooking, type ManualBookingResult } from "./actions";

type Option = { id: string; name: string };

export function NewBookingForm({ services, staff }: { services: Option[]; staff: Option[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ManualBookingResult | null, FormData>(
    createManualBooking,
    null
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-page"
      >
        {open ? "Close" : "+ New booking"}
      </button>

      {open && (
        <form
          action={formAction}
          className="mt-3 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6"
        >
          <div className="text-sm font-medium text-ink-secondary">
            For a booking taken by phone, LINE, or walk-in
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="date" name="date" className="rounded-lg border border-border px-3 py-2 text-sm" />
            <input type="time" name="time" className="rounded-lg border border-border px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              name="customerName"
              placeholder="Customer name"
              className="rounded-lg border border-border px-3 py-2 text-sm"
            />
            <input
              name="customerPhone"
              placeholder="Phone number"
              className="rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
          <input
            name="customerEmail"
            type="email"
            placeholder="Email (optional)"
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <input type="checkbox" name="noCharge" />
            No charge for this booking
          </label>

          {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}
          <button
            type="submit"
            disabled={pending || services.length === 0 || staff.length === 0}
            className="self-start rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink disabled:opacity-50"
          >
            {pending ? "Creating..." : "Create booking"}
          </button>
        </form>
      )}
    </div>
  );
}

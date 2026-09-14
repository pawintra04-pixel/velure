"use client";

import { useActionState } from "react";
import { addStaff, type ActionResult } from "./actions";

export function AddStaffForm({ services }: { services: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    addStaff,
    null
  );

  return (
    <form
      action={formAction}
      className="mt-3 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5"
    >
      <input
        name="name"
        placeholder="Name"
        className="rounded-lg border border-border px-3 py-2 text-sm"
      />

      {services.length > 0 && (
        <div>
          <div className="text-sm text-ink-secondary">Can perform</div>
          <div className="mt-2 flex flex-col gap-2">
            {services.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="serviceIds" value={s.id} />
                {s.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Adding..." : "Add team member"}
      </button>
    </form>
  );
}

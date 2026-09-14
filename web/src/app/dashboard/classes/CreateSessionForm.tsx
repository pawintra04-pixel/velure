"use client";

import { useActionState } from "react";
import { createClassSession, type ActionResult } from "./actions";

type Option = { id: string; name: string };

export function CreateSessionForm({ services, staff }: { services: Option[]; staff: Option[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createClassSession,
    null
  );

  if (services.length === 0) {
    return (
      <div className="mt-3 rounded-2xl border border-border bg-surface p-5 text-sm text-ink-muted">
        No class-type services yet — set a service&apos;s capacity to 2 or more on the Services
        page to schedule sessions for it.
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
      <div className="grid grid-cols-2 gap-3">
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
      <div className="grid grid-cols-2 gap-3">
        <input type="date" name="date" className="rounded-lg border border-border px-3 py-2 text-sm" />
        <input type="time" name="time" className="rounded-lg border border-border px-3 py-2 text-sm" />
      </div>
      {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}
      <button
        type="submit"
        disabled={pending || staff.length === 0}
        className="self-start rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Scheduling..." : "Schedule session"}
      </button>
      {staff.length === 0 && (
        <div className="text-sm text-ink-muted">Add a team member first on the Team page.</div>
      )}
    </form>
  );
}

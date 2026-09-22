"use client";

import { useActionState, useState } from "react";
import { addStaff, type ActionResult } from "./actions";
import { teamText, type Locale } from "@/lib/i18n";

export function AddStaffForm({
  services,
  locale,
}: {
  services: { id: string; name: string }[];
  locale: Locale;
}) {
  const t = teamText[locale];
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    addStaff,
    null
  );

  // Adjusted during render (not in an effect) — same pattern Sidebar.tsx
  // uses for reacting to a value changing between renders.
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
        {t.addTeamMember}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5"
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-ink-secondary">{t.addTeamMemberTitle}</div>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-muted hover:text-ink-secondary">
          {t.close}
        </button>
      </div>
      <input
        name="name"
        placeholder={t.name}
        className="rounded-lg border border-border px-3 py-2 text-sm"
      />

      {services.length > 0 && (
        <div>
          <div className="text-sm text-ink-secondary">{t.canPerform}</div>
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
        className="rounded-xl bg-sunburst py-2.5 text-sm font-medium text-ink disabled:opacity-50"
      >
        {pending ? t.adding : t.addTeamMemberButton}
      </button>
    </form>
  );
}

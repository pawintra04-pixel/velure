"use client";

import { useActionState } from "react";
import { createClassSession, type ActionResult } from "./actions";
import { classesText, type Locale } from "@/lib/i18n";

type Option = { id: string; name: string };

export function CreateSessionForm({
  services,
  staff,
  resources,
  locale,
}: {
  services: Option[];
  staff: Option[];
  resources: Option[];
  locale: Locale;
}) {
  const t = classesText[locale];
  const WEEKDAYS = [
    { value: "0", label: t.sun },
    { value: "1", label: t.mon },
    { value: "2", label: t.tue },
    { value: "3", label: t.wed },
    { value: "4", label: t.thu },
    { value: "5", label: t.fri },
    { value: "6", label: t.sat },
  ];
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createClassSession,
    null
  );

  // The caller (ClassesPage) only renders this form once at least one
  // class-capable service exists — see its own "Classes aren't set up yet"
  // panel for that empty state — so `services` is never empty here.
  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
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

      <details className="rounded-lg border border-border px-3 py-2">
        <summary className="cursor-pointer text-sm text-ink-secondary">
          {t.repeatWeekly}
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <label
                key={d.value}
                className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-ink-secondary has-checked:border-sunburst has-checked:bg-sunburst/10 has-checked:text-ink"
              >
                <input type="checkbox" name="weekdays" value={d.value} className="sr-only" />
                {d.label}
              </label>
            ))}
          </div>
          <div>
            <label className="text-xs text-ink-muted">{t.repeatUntil}</label>
            <input
              type="date"
              name="repeatUntil"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
          <p className="text-xs text-ink-muted">
            {t.repeatHint}
          </p>
        </div>
      </details>

      {resources.length > 0 && (
        <select name="resourceId" className="rounded-lg border border-border px-3 py-2 text-sm" defaultValue="">
          <option value="">{t.noRoom}</option>
          {resources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}
      {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}
      {state && state.ok && state.message && <div className="text-sm text-[#1b8a5a]">{state.message}</div>}
      <button
        type="submit"
        disabled={pending || staff.length === 0}
        className="self-start rounded-xl bg-sunburst px-4 py-2.5 text-sm font-medium text-ink disabled:opacity-50"
      >
        {pending ? t.scheduling : t.scheduleSessionButton}
      </button>
      {staff.length === 0 && (
        <div className="text-sm text-ink-muted">{t.addTeamMemberFirst}</div>
      )}
    </form>
  );
}

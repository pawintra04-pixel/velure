"use client";

import { useActionState, useState } from "react";
import { createResource, type ActionResult } from "./actions";
import { resourcesText, type Locale } from "@/lib/i18n";

export function RoomForm({ locale }: { locale: Locale }) {
  const t = resourcesText[locale];
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createResource,
    null
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          open
            ? "rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-page"
            : "rounded-lg bg-sunburst px-4 py-2 text-sm font-medium text-ink transition-[filter] hover:brightness-95"
        }
      >
        {open ? t.close : t.addResource}
      </button>

      {open && (
        <form action={formAction} className="mt-3 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center">
          <input
            name="name"
            placeholder={t.namePlaceholder}
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
          />
          {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}
          <button
            type="submit"
            disabled={pending}
            className="self-start rounded-xl bg-sunburst px-4 py-2.5 text-sm font-medium text-ink disabled:opacity-50"
          >
            {pending ? t.adding : t.addResourceButton}
          </button>
        </form>
      )}
    </div>
  );
}

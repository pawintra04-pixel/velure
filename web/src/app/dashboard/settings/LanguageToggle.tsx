"use client";

import { useActionState } from "react";
import { updateLocale, type ActionResult } from "./actions";
import type { Locale } from "@/lib/i18n";

// Deliberately auto-submits on click rather than needing a separate Save
// button — this is a preference toggle (pick one of two), not a form with
// fields to review before committing, so the extra step would just be
// friction. Owner-scoped, not business-scoped: see 028_owner_locale.sql.
export function LanguageToggle({ locale, onDark = false }: { locale: Locale; onDark?: boolean }) {
  const [, formAction, pending] = useActionState<ActionResult | null, FormData>(updateLocale, null);

  return (
    <form
      action={formAction}
      className={`flex items-center gap-1.5 rounded-full border p-0.5 ${onDark ? "border-white/15" : "border-border"}`}
    >
      {(["en", "th"] as const).map((l) => (
        <button
          key={l}
          type="submit"
          name="locale"
          value={l}
          disabled={pending}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
            locale === l
              ? onDark
                ? "bg-sunburst text-midnight"
                : "bg-midnight text-sunburst"
              : onDark
                ? "text-midnight-ink-muted hover:text-midnight-ink"
                : "text-ink-secondary hover:bg-page"
          }`}
        >
          {l === "en" ? "English" : "ไทย"}
        </button>
      ))}
    </form>
  );
}

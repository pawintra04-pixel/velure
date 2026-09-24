import type { Locale } from "@/lib/i18n";
import { setVisitorLocale } from "@/app/locale-actions";

// EN / ไทย toggle for public pages (booking funnel, owner login/signup).
// A plain server-action form — no client JS needed.
export function LocaleSwitch({ locale, className = "" }: { locale: Locale; className?: string }) {
  return (
    <form action={setVisitorLocale} className={`flex items-center gap-0.5 rounded-full border border-border p-0.5 ${className}`}>
      {(["en", "th"] as const).map((l) => (
        <button
          key={l}
          type="submit"
          name="locale"
          value={l}
          aria-pressed={locale === l}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
            locale === l ? "bg-midnight text-sunburst" : "text-ink-secondary hover:bg-page"
          }`}
        >
          {l === "en" ? "EN" : "ไทย"}
        </button>
      ))}
    </form>
  );
}

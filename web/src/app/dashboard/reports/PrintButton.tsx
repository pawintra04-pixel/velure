"use client";

import { reportsText, type Locale } from "@/lib/i18n";

export function PrintButton({ locale }: { locale: Locale }) {
  const t = reportsText[locale];
  return (
    <button
      onClick={() => window.print()}
      className="rounded-full border border-border px-4 py-1.5 text-sm text-ink-secondary hover:bg-page"
    >
      {t.print}
    </button>
  );
}

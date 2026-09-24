import Link from "next/link";
import { EmbedAutoResize } from "@/components/booking/EmbedAutoResize";
import { getVisitorLocale } from "@/lib/visitor-locale";
import { publicText } from "@/lib/i18n-public";

// Wraps every page under /book/* (service select, time picker, details,
// pay, confirmed, manage) — one place for anything that should apply to
// the whole public booking funnel regardless of which step a visitor is
// on, starting with the embed auto-resize reporter (see its own comment).
export default async function BookLayout({ children }: { children: React.ReactNode }) {
  const t = publicText[await getVisitorLocale()];
  return (
    <>
      <EmbedAutoResize />
      {children}
      {/* Customers enter personal data here, so the privacy notice has to
          be reachable from every step of the funnel (PDPA). */}
      <footer className="px-4 pb-6 pt-2 text-center text-xs text-ink-muted">
        {t.legalAgreePrefix}{" "}
        <Link href="/terms" target="_blank" className="underline hover:text-ink-secondary">
          {t.terms}
        </Link>{" "}
        {t.and}{" "}
        <Link href="/privacy" target="_blank" className="underline hover:text-ink-secondary">
          {t.privacy}
        </Link>{" "}
        · {t.poweredBy}
      </footer>
    </>
  );
}

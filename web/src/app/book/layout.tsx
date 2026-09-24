import Link from "next/link";
import { EmbedAutoResize } from "@/components/booking/EmbedAutoResize";

// Wraps every page under /book/* (service select, time picker, details,
// pay, confirmed, manage) — one place for anything that should apply to
// the whole public booking funnel regardless of which step a visitor is
// on, starting with the embed auto-resize reporter (see its own comment).
export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <EmbedAutoResize />
      {children}
      {/* Customers enter personal data here, so the privacy notice has to
          be reachable from every step of the funnel (PDPA). */}
      <footer className="px-4 pb-6 pt-2 text-center text-xs text-ink-muted">
        การจองถือว่ายอมรับ{" "}
        <Link href="/terms" target="_blank" className="underline hover:text-ink-secondary">
          ข้อกำหนดการใช้งาน
        </Link>{" "}
        และ{" "}
        <Link href="/privacy" target="_blank" className="underline hover:text-ink-secondary">
          นโยบายความเป็นส่วนตัว
        </Link>{" "}
        · ให้บริการโดย Velure
      </footer>
    </>
  );
}

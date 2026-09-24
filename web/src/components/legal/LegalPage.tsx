import Link from "next/link";
import type { ReactNode } from "react";

export const LEGAL_LAST_UPDATED = "24 กันยายน 2569";

export function legalContactEmail(): string | null {
  return process.env.LEGAL_CONTACT_EMAIL?.trim() || null;
}

// Shared shell for /privacy and /terms — plain, readable, mobile-first long
// text rather than dashboard chrome, since both customers and shop owners
// land here from public pages.
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="text-sm text-ink-muted">Velure</div>
      <h1 className="mt-1 text-2xl font-semibold text-ink">{title}</h1>
      <p className="mt-1 text-sm text-ink-muted">ปรับปรุงล่าสุด: {LEGAL_LAST_UPDATED}</p>
      <div className="mt-8 flex flex-col gap-6 text-[15px] leading-relaxed text-ink-secondary">{children}</div>
      <nav className="mt-12 flex gap-4 border-t border-border pt-4 text-sm">
        <Link href="/privacy" className="text-accent underline">
          นโยบายความเป็นส่วนตัว
        </Link>
        <Link href="/terms" className="text-accent underline">
          ข้อกำหนดการใช้งาน
        </Link>
      </nav>
    </main>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[17px] font-medium text-ink">{heading}</h2>
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </section>
  );
}

export function ContactLine() {
  const email = legalContactEmail();
  return email ? (
    <p>
      อีเมล:{" "}
      <a href={`mailto:${email}`} className="text-accent underline">
        {email}
      </a>
    </p>
  ) : (
    <p>ติดต่อผ่านร้านค้าที่คุณใช้บริการ หรือทางช่องทางที่ Velure ประกาศไว้</p>
  );
}

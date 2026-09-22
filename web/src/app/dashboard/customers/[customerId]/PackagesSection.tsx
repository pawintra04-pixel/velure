"use client";

import { useActionState, useState } from "react";
import { sellPackage, bookFromPackage } from "../actions";
import type { ActionResult } from "../actions";
import { formatBaht } from "@/lib/money";
import type { ActivePackage } from "@/lib/packages";
import type { SellablePackage } from "@/lib/customers-data";
import { customersText, type Locale } from "@/lib/i18n";

function BookFromPackageForm({
  customerId,
  pkg,
  locale,
}: {
  customerId: string;
  pkg: ActivePackage;
  locale: Locale;
}) {
  const t = customersText[locale];
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    bookFromPackage,
    null
  );

  if (state?.ok && open) setOpen(false);

  return (
    <div className="mt-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-page"
        >
          {t.bookSession}
        </button>
      ) : (
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="customerId" value={customerId} />
          <input type="hidden" name="packagePurchaseId" value={pkg.id} />
          <input type="hidden" name="serviceId" value={pkg.serviceId} />
          <input type="date" name="date" required className="rounded-lg border border-border px-2 py-1.5 text-xs" />
          <input type="time" name="time" required className="rounded-lg border border-border px-2 py-1.5 text-xs" />
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-sunburst px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-50"
          >
            {pending ? t.booking : t.confirmBooking}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-ink-muted hover:text-ink-secondary"
          >
            {t.cancelAction}
          </button>
        </form>
      )}
      {state && !state.ok && <div className="mt-1 text-xs text-[#d03b3b]">{state.error}</div>}
    </div>
  );
}

function SellPackageForm({
  customerId,
  packages,
  locale,
}: {
  customerId: string;
  packages: SellablePackage[];
  locale: Locale;
}) {
  const t = customersText[locale];
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(sellPackage, null);

  if (packages.length === 0) {
    return <p className="text-sm text-ink-muted">{t.noPackagesToSell}</p>;
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="customerId" value={customerId} />
      <select name="packageId" className="rounded-lg border border-border px-3 py-2 text-sm">
        {packages.map((p) => (
          <option key={p.id} value={p.id}>
            {p.serviceName} — {p.name} ({p.sessionCount} × · {formatBaht(p.priceAmount)})
          </option>
        ))}
      </select>
      <select name="paymentMethod" defaultValue="cash" className="rounded-lg border border-border px-3 py-2 text-sm">
        <option value="cash">{t.paymentCash}</option>
        <option value="card">{t.paymentCard}</option>
        <option value="promptpay">{t.paymentPromptpay}</option>
        <option value="other">{t.paymentOther}</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-page disabled:opacity-50"
      >
        {pending ? t.selling : t.sellPackage}
      </button>
      {state && !state.ok && <div className="w-full text-sm text-[#d03b3b]">{state.error}</div>}
    </form>
  );
}

function formatExpiry(iso: string | null, locale: Locale, noExpiry: string): string {
  if (!iso) return noExpiry;
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
  }).format(new Date(iso));
}

export function PackagesSection({
  customerId,
  activePackages,
  sellablePackages,
  locale,
}: {
  customerId: string;
  activePackages: ActivePackage[];
  sellablePackages: SellablePackage[];
  locale: Locale;
}) {
  const t = customersText[locale];

  return (
    <div className="mt-8">
      <div className="text-[13.5px] font-semibold uppercase tracking-wide text-ink">
        {t.packages} ({activePackages.length})
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {activePackages.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-ink-muted">
            {t.noActivePackages}
          </div>
        )}
        {activePackages.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium">{p.packageName}</span>{" "}
                <span className="text-ink-muted">· {p.serviceName}</span>
              </div>
              <span className="rounded-full bg-[#eaf1fb] px-2 py-0.5 text-xs font-medium text-[#3462ad]">
                {p.sessionsRemaining}/{p.sessionsTotal} {t.sessionsLeftSuffix}
              </span>
            </div>
            <div className="mt-1 text-xs text-ink-muted">
              {t.expires}: {formatExpiry(p.expiresAt, locale, t.never)}
            </div>
            <BookFromPackageForm customerId={customerId} pkg={p} locale={locale} />
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="text-xs font-medium text-ink-secondary">{t.sellAPackage}</div>
        <div className="mt-2">
          <SellPackageForm customerId={customerId} packages={sellablePackages} locale={locale} />
        </div>
      </div>
    </div>
  );
}

import { requireOwner } from "@/lib/auth";
import { listWaitlistEntries } from "@/lib/waitlist";
import { removeWaitlistEntry } from "./actions";
import { PageShell, PageHeader } from "@/components/dashboard/PageShell";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { waitlistText, type Locale } from "@/lib/i18n";

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
  }).format(new Date(value));
}

export default async function WaitlistPage() {
  const owner = await requireOwner();
  const locale = owner.locale;
  const t = waitlistText[locale];

  const entries = await listWaitlistEntries(owner.businessId);

  return (
    <PageShell width="standard">
      <div className="border-b border-border pb-5">
        <PageHeader title={t.title} description={t.description} />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {entries.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            {t.noEntries}
          </div>
        )}
        {entries.map((e) => (
          <div key={e.id} className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="font-medium">
                  {e.customerName} <span className="text-ink-muted">· {e.serviceName}</span>
                </div>
                <div className="mt-1 text-sm text-ink-muted">
                  {formatDate(e.targetDate, locale)}
                  {e.customerPhone && <> · {e.customerPhone}</>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    e.status === "notified" ? "bg-[#eaf1fb] text-[#3462ad]" : "bg-soft-yellow-surface text-[#a8681c]"
                  }`}
                >
                  {e.status === "notified"
                    ? `${t.notified}${e.notifiedChannels && e.notifiedChannels.length > 0 ? ` (${t.notifiedVia} ${e.notifiedChannels.join(", ")})` : ""}`
                    : t.waiting}
                </span>
                <ConfirmSubmitButton
                  action={removeWaitlistEntry}
                  hiddenFields={{ entryId: e.id }}
                  label={t.remove}
                  pendingLabel={t.removing}
                  confirmTitle={t.removeTitle}
                  confirmDescription={t.removeDesc}
                  confirmLabel={t.remove}
                  danger
                  buttonClassName="rounded-full border border-border px-3 py-1.5 text-sm text-ink-secondary hover:bg-page"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

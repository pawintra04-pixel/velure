import Link from "next/link";
import { formatBaht } from "@/lib/money";
import type { AttentionItems } from "@/lib/dashboard-data";

function formatCountdown(iso: string, nowMs: number): string {
  const diffMin = Math.round((new Date(iso).getTime() - nowMs) / 60_000);
  if (diffMin < 0) return "Already started";
  if (diffMin < 60) return `Starts in ${diffMin} minute${diffMin === 1 ? "" : "s"}`;
  const hours = Math.round(diffMin / 60);
  return `Starts in ${hours} hour${hours === 1 ? "" : "s"}`;
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

type Row = { key: string; title: string; subtitle: string; action: { label: string; href: string } };

// Exactly three real, independent conditions (see getAttentionItems) —
// never a generic rules list. `nextUnpaid`'s action is labelled "View",
// not "Remind": there is no reminder/notification-send capability in the
// app yet, so this links to the real booking record instead of pretending
// to dispatch a reminder.
export function NeedsAttention({ data }: { data: AttentionItems }) {
  const nowMs = new Date().getTime();
  const rows: Row[] = [];

  if (data.pendingPayments) {
    rows.push({
      key: "pending",
      title: `${data.pendingPayments.count} payment${data.pendingPayments.count === 1 ? "" : "s"} awaiting confirmation`,
      subtitle: `${formatBaht(data.pendingPayments.totalSatang)} total`,
      action: { label: "Review", href: "/dashboard/bookings?status=TEMPORARY_HOLD,PAYMENT_PENDING" },
    });
  }
  if (data.nextUnpaid) {
    rows.push({
      key: "unpaid",
      title: `${data.nextUnpaid.customerName} · ${formatTime(data.nextUnpaid.startTime)} · unpaid`,
      subtitle: formatCountdown(data.nextUnpaid.startTime, nowMs),
      action: {
        label: "View",
        href: `/dashboard/bookings?status=TEMPORARY_HOLD,PAYMENT_PENDING#booking-${data.nextUnpaid.bookingId}`,
      },
    });
  }
  if (data.stripeSetupIncomplete) {
    rows.push({
      key: "stripe",
      title: "Stripe setup incomplete",
      subtitle: "Card payments are off",
      action: { label: "Finish", href: "/dashboard/settings" },
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13.5px] font-semibold uppercase tracking-wide text-ink">Needs attention</div>
        {rows.length > 0 && (
          <span className="rounded-full bg-sunburst px-2.5 py-0.5 font-mono text-[12.5px] font-semibold text-ink">
            {rows.length}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="mt-3 text-[14px] text-ink-muted">All caught up — nothing needs attention right now.</div>
      ) : (
        <div className="mt-3 rounded-xl border border-sunburst/60 bg-soft-yellow-surface px-4">
          {rows.map((row, i) => (
            <div
              key={row.key}
              className={`flex items-start justify-between gap-3 py-4 ${
                i < rows.length - 1 ? "border-b border-ink/[0.06]" : ""
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sunburst" />
                <div className="min-w-0">
                  <div className="truncate text-[15px] text-ink">{row.title}</div>
                  <div className="mt-0.5 truncate text-[13px] text-[#8a8054]">{row.subtitle}</div>
                </div>
              </div>
              <Link href={row.action.href} className="shrink-0 text-[13px] font-semibold text-ink hover:underline">
                {row.action.label} &rarr;
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

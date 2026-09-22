import { formatBaht } from "@/lib/money";
import type { CalendarBooking } from "@/lib/bookings-data";
import { statusMeta } from "@/lib/booking-status";
import { updateBookingStatus, updateBookingNote } from "./actions";
import { RefundButton, type RefundKind } from "./RefundButton";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { bookingsText, tPaidLine, tRefundedLine, type Locale } from "@/lib/i18n";

// Which of the three refund paths applies to this booking (see
// refundBooking's own comment in actions.ts) — null means nothing to
// refund/restore, so no button should render at all. Decided from the
// booking's own data the same way the server does, purely for which
// control to show; the server independently re-derives and enforces this,
// never trusts the client's choice of kind.
function refundKindFor(b: CalendarBooking): RefundKind | null {
  if (b.hasPayment && b.amount > 0) return "stripe";
  if (b.packagePurchaseId) return "package";
  if (b.amount > 0) return "cash";
  return null;
}

// Kept as a className map (not the shared statusMeta color) for WeekView's
// small filled chips specifically — a background tint needs a Tailwind
// class, not just a color. Pending/partially-refunded now match the same
// --status-pending hex the rest of the app uses instead of the old ad-hoc
// amber, so the two representations of "pending" agree.
const STATUS_STYLE: Record<string, string> = {
  CONFIRMED: "bg-[#0ca30c]/10 text-[#0ca30c]",
  PAYMENT_PENDING: "bg-[#a8681c]/10 text-[#a8681c]",
  TEMPORARY_HOLD: "bg-ink/5 text-ink-muted",
  COMPLETED: "bg-ink/5 text-ink-secondary",
  CANCELLED: "bg-ink/5 text-ink-muted line-through",
  NO_SHOW: "bg-[#d03b3b]/10 text-[#d03b3b]",
  PAYMENT_FAILED: "bg-[#d03b3b]/10 text-[#d03b3b]",
  EXPIRED: "bg-ink/5 text-ink-muted",
  REFUNDED: "bg-ink/5 text-ink-muted line-through",
  PARTIALLY_REFUNDED: "bg-[#a8681c]/10 text-[#a8681c]",
};

const REFUNDABLE_STATUSES = ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatTimeOnly(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// Compact date+time for the List view's row, which spans many days (unlike
// Day view / class-attendee rows, which are already scoped to one day and
// just need the time) — short enough to sit in a single-line row without
// pushing customer/service off to the side.
function formatDateTimeCompact(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

// The same real-detail summary every consequential confirmation for this
// booking shows — who, what, when, and its current payment state — so a
// confirmation dialog never reduces to a bare "Are you sure?".
function BookingSummary({ b, locale }: { b: CalendarBooking; locale: Locale }) {
  const t = bookingsText[locale];
  const paidLine = tPaidLine(locale, b.amount, formatBaht(b.amount), b.hasPayment);
  return (
    <div className="rounded-lg bg-page px-3 py-2 text-sm text-ink">
      <div>{b.customerName ?? t.unnamedCustomer}</div>
      <div className="text-ink-secondary">{b.serviceName}</div>
      <div className="text-ink-secondary">{formatTime(b.startTime)}</div>
      <div className="text-ink-secondary">{paidLine}</div>
    </div>
  );
}

function StatusDot({ status, locale }: { status: string; locale: Locale }) {
  const meta = statusMeta(status, locale);
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px]" style={{ color: meta.color }}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.color }} />
      <span className={meta.strike ? "line-through" : ""}>{meta.label}</span>
    </span>
  );
}

// One scannable row: time / customer / service·staff / status, with every
// secondary action (Complete, No-show, Cancel, Refund, Note & flag) tucked
// behind a single disclosure instead of five buttons fighting for space on
// the row itself. The whole row IS the <summary> (native <details>, no
// client JS) so the expanded actions panel always renders as its own
// full-width block below the row — never squeezed into the row's flex
// layout, which is what caused the original per-action buttons to overflow
// horizontally on narrow screens. Renders with no border/rounded/bg of its
// own — the list it's placed in owns one shared container + thin dividers,
// so N bookings read as one list, not N cards.
export function BookingRow({ b, locale, compact = false }: { b: CalendarBooking; locale: Locale; compact?: boolean }) {
  const t = bookingsText[locale];
  const refundKind = refundKindFor(b);
  return (
    <details
      id={`booking-${b.id}`}
      className={`[&_summary::-webkit-details-marker]:hidden ${b.isFlagged ? "border-l-2 border-l-[#a8681c] bg-[#fdf3e6]/40" : ""}`}
    >
      <summary className="flex cursor-pointer list-none flex-col gap-2 px-4 py-3 hover:bg-ink/[0.02] sm:flex-row sm:items-center sm:gap-4 sm:py-2.5">
        <div className="flex items-center justify-between gap-3 sm:contents">
          <span className="shrink-0 whitespace-nowrap font-mono text-[13px] text-ink-muted">
            {compact ? formatTimeOnly(b.startTime) : formatDateTimeCompact(b.startTime)}
          </span>
          <span className="sm:hidden">
            <StatusDot status={b.status} locale={locale} />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate text-[14.5px] text-ink">
            {b.isFlagged && <span title="Flagged for special attention">📌</span>}
            {b.customerName ?? t.unnamedCustomer}
          </div>
          <div className="truncate text-[13px] text-ink-muted">
            {b.serviceName} · {b.staffName} · {formatBaht(b.amount)}
            {b.paymentMethod === "cash" && b.status === "CONFIRMED" && (
              <span className="ml-1.5 rounded-full bg-[#fdf3e6] px-2 py-0.5 text-[11px] text-[#a8681c]">
                💵 {t.inPerson}
              </span>
            )}
          </div>
          {b.ownerNote && <div className="mt-0.5 truncate text-[13px] text-[#a8681c]">{b.ownerNote}</div>}
          {b.refundedAt && (
            <div className="mt-0.5 truncate text-[13px] text-ink-muted">
              {tRefundedLine(locale, b.refundedAmount != null ? formatBaht(b.refundedAmount) : null, b.refundedAt)}
            </div>
          )}
        </div>

        <span className="hidden shrink-0 sm:block sm:w-40">
          <StatusDot status={b.status} locale={locale} />
        </span>

        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center self-end rounded-full text-ink-muted sm:self-auto"
        >
          ⋯
        </span>
      </summary>

      <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {b.status === "CONFIRMED" && (
            <>
              <ConfirmSubmitButton
                action={updateBookingStatus}
                hiddenFields={{ bookingId: b.id, nextStatus: "COMPLETED" }}
                label={t.complete}
                confirmTitle={t.markCompleteTitle}
                confirmDescription={
                  <>
                    <BookingSummary b={b} locale={locale} />
                    <p className="mt-3">{t.markCompleteDesc}</p>
                  </>
                }
                confirmLabel={t.markComplete}
                buttonClassName="rounded-full border border-border px-3 py-2 text-xs hover:bg-page"
              />
              <ConfirmSubmitButton
                action={updateBookingStatus}
                hiddenFields={{ bookingId: b.id, nextStatus: "NO_SHOW" }}
                label={t.noShow}
                confirmTitle={t.markNoShowTitle}
                confirmDescription={
                  <>
                    <BookingSummary b={b} locale={locale} />
                    <p className="mt-3">{t.markNoShowDesc}</p>
                  </>
                }
                confirmLabel={t.markNoShow}
                buttonClassName="rounded-full border border-border px-3 py-2 text-xs hover:bg-page"
              />
            </>
          )}
          {["TEMPORARY_HOLD", "PAYMENT_PENDING", "CONFIRMED"].includes(b.status) && (
            <ConfirmSubmitButton
              action={updateBookingStatus}
              hiddenFields={{ bookingId: b.id, nextStatus: "CANCELLED" }}
              label={t.cancel}
              confirmTitle={t.cancelTitle}
              confirmDescription={
                <>
                  <BookingSummary b={b} locale={locale} />
                  <p className="mt-3">
                    {t.cancelDescBase}
                    {b.hasPayment && b.amount > 0 && <strong>{t.cancelDescPayment}</strong>}
                  </p>
                </>
              }
              confirmLabel={t.cancelBooking}
              cancelLabel={t.keepBooking}
              danger
              buttonClassName="rounded-full border border-border px-3 py-2 text-xs hover:bg-page"
            />
          )}
          {refundKind && REFUNDABLE_STATUSES.includes(b.status) && (
            <RefundButton bookingId={b.id} b={b} locale={locale} kind={refundKind} />
          )}
        </div>

        <ConfirmSubmitButton
          action={updateBookingNote}
          hiddenFields={{ bookingId: b.id }}
          label={t.save}
          requireConfirm={false}
          confirmTitle=""
          confirmDescription={null}
          confirmLabel={t.save}
          buttonClassName="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-page shrink-0"
          formClassName="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center"
        >
          <input
            name="note"
            defaultValue={b.ownerNote ?? ""}
            placeholder={t.notePlaceholder}
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-1.5 text-sm text-ink-secondary">
            <input type="checkbox" name="flagged" defaultChecked={b.isFlagged} />
            {t.flag}
          </label>
        </ConfirmSubmitButton>
      </div>
    </details>
  );
}

// One shared bordered container for a list of BookingRows, with thin
// dividers between them — so N bookings read as a single compact list
// (low-card UI) instead of N separately-bordered cards stacked with gaps.
export function BookingList({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface divide-y divide-border">
      {children}
    </div>
  );
}

export { STATUS_STYLE };

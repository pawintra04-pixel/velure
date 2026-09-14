import { formatBaht } from "@/lib/money";
import type { CalendarBooking } from "@/lib/bookings-data";
import { updateBookingStatus } from "./actions";

const STATUS_STYLE: Record<string, string> = {
  CONFIRMED: "bg-[#0ca30c]/10 text-[#0ca30c]",
  PAYMENT_PENDING: "bg-[#fab219]/20 text-[#8a5a00]",
  TEMPORARY_HOLD: "bg-ink/5 text-ink-muted",
  COMPLETED: "bg-ink/5 text-ink-secondary",
  CANCELLED: "bg-ink/5 text-ink-muted line-through",
  NO_SHOW: "bg-[#d03b3b]/10 text-[#d03b3b]",
  PAYMENT_FAILED: "bg-[#d03b3b]/10 text-[#d03b3b]",
  EXPIRED: "bg-ink/5 text-ink-muted",
};

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

export function BookingRow({ b, compact = false }: { b: CalendarBooking; compact?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-5">
      <div className="min-w-0">
        <div className="truncate font-medium">{b.customerName ?? "Unnamed customer"}</div>
        <div className="truncate text-sm text-ink-muted">
          {b.serviceName} · {b.staffName} · {compact ? formatTimeOnly(b.startTime) : formatTime(b.startTime)} ·{" "}
          {formatBaht(b.amount)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            STATUS_STYLE[b.status] ?? "bg-ink/5 text-ink-muted"
          }`}
        >
          {b.status.replace("_", " ")}
        </span>
        {b.status === "CONFIRMED" && (
          <>
            <form action={updateBookingStatus}>
              <input type="hidden" name="bookingId" value={b.id} />
              <input type="hidden" name="nextStatus" value="COMPLETED" />
              <button className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-page">
                Complete
              </button>
            </form>
            <form action={updateBookingStatus}>
              <input type="hidden" name="bookingId" value={b.id} />
              <input type="hidden" name="nextStatus" value="NO_SHOW" />
              <button className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-page">
                No-show
              </button>
            </form>
          </>
        )}
        {["TEMPORARY_HOLD", "PAYMENT_PENDING", "CONFIRMED"].includes(b.status) && (
          <form action={updateBookingStatus}>
            <input type="hidden" name="bookingId" value={b.id} />
            <input type="hidden" name="nextStatus" value="CANCELLED" />
            <button className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-page">
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export { STATUS_STYLE };

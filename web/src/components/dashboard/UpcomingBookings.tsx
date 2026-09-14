import type { UpcomingBooking } from "@/lib/dashboard-data";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  CONFIRMED: { label: "ยืนยันแล้ว", className: "bg-[#0ca30c]/10 text-[#0ca30c]" },
  PAYMENT_PENDING: { label: "รอชำระเงิน", className: "bg-[#fab219]/20 text-[#8a5a00]" },
  TEMPORARY_HOLD: { label: "จองชั่วคราว", className: "bg-ink/5 text-ink-muted" },
};

// TODO: use the business's own `timezone` column (docs/ARCHITECTURE.md) once
// pages are wired to a real authenticated business rather than the demo one.
function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function UpcomingBookings({ bookings }: { bookings: UpcomingBooking[] }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="text-sm text-ink-secondary">นัดหมายที่จะถึง</div>
      <div className="mt-4 flex flex-col gap-3">
        {bookings.length === 0 && (
          <div className="text-sm text-ink-muted">ยังไม่มีนัดหมายที่จะถึง</div>
        )}
        {bookings.map((b) => {
          const status = STATUS_LABEL[b.status] ?? {
            label: b.status,
            className: "bg-ink/5 text-ink-muted",
          };
          return (
            <div key={b.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {b.customerName ?? "ลูกค้าไม่ระบุชื่อ"}
                </div>
                <div className="truncate text-xs text-ink-muted">
                  {b.serviceName} · {b.staffName} · {formatTime(b.startTime)}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
              >
                {status.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

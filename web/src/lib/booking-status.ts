// Canonical booking-status -> semantic meaning, shared by every screen that
// shows a status (Overview's schedule, Bookings rows, Calendar blocks, the
// Week/Month mini views) so "confirmed" is the same green everywhere rather
// than each screen picking its own hex. Colors reference the app's existing
// --status-* tokens (globals.css) — Sunburst is never used here, it's
// reserved for primary actions/attention, not booking state.
export type BookingStatusMeta = { label: string; color: string; strike?: boolean };

export const STATUS_META: Record<string, BookingStatusMeta> = {
  CONFIRMED: { label: "Confirmed", color: "var(--status-confirmed)" },
  COMPLETED: { label: "Completed", color: "var(--status-neutral)" },
  PAYMENT_PENDING: { label: "Payment pending", color: "var(--status-pending)" },
  TEMPORARY_HOLD: { label: "Temporary hold", color: "var(--status-neutral)" },
  CANCELLED: { label: "Cancelled", color: "var(--status-neutral)", strike: true },
  NO_SHOW: { label: "No-show", color: "var(--status-critical)" },
  PAYMENT_FAILED: { label: "Payment failed", color: "var(--status-critical)" },
  EXPIRED: { label: "Expired", color: "var(--status-neutral)" },
  REFUNDED: { label: "Refunded", color: "var(--status-neutral)", strike: true },
  PARTIALLY_REFUNDED: { label: "Partially refunded", color: "var(--status-pending)" },
};

export function statusMeta(status: string): BookingStatusMeta {
  return STATUS_META[status] ?? { label: status.replace(/_/g, " "), color: "var(--status-neutral)" };
}

import type { Locale } from "@/lib/i18n";

// Canonical booking-status -> semantic meaning, shared by every screen that
// shows a status (Overview's schedule, Bookings rows, Calendar blocks, the
// Week/Month mini views) so "confirmed" is the same green everywhere rather
// than each screen picking its own hex. Colors reference the app's existing
// --status-* tokens (globals.css) — Sunburst is never used here, it's
// reserved for primary actions/attention, not booking state.
export type BookingStatusMeta = { label: string; color: string; strike?: boolean };

const STATUS_META_EN: Record<string, BookingStatusMeta> = {
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

const STATUS_META_TH: Record<string, BookingStatusMeta> = {
  CONFIRMED: { label: "ยืนยันแล้ว", color: "var(--status-confirmed)" },
  COMPLETED: { label: "เสร็จสิ้น", color: "var(--status-neutral)" },
  PAYMENT_PENDING: { label: "รอชำระเงิน", color: "var(--status-pending)" },
  TEMPORARY_HOLD: { label: "กันที่ไว้ชั่วคราว", color: "var(--status-neutral)" },
  CANCELLED: { label: "ยกเลิกแล้ว", color: "var(--status-neutral)", strike: true },
  NO_SHOW: { label: "ไม่มาตามนัด", color: "var(--status-critical)" },
  PAYMENT_FAILED: { label: "ชำระเงินไม่สำเร็จ", color: "var(--status-critical)" },
  EXPIRED: { label: "หมดอายุ", color: "var(--status-neutral)" },
  REFUNDED: { label: "คืนเงินแล้ว", color: "var(--status-neutral)", strike: true },
  PARTIALLY_REFUNDED: { label: "คืนเงินบางส่วน", color: "var(--status-pending)" },
};

// Defaults to "en" so any call site that hasn't been threaded a locale yet
// (there shouldn't be any after this pass, but a missed one fails safe to
// the original behavior instead of a runtime error).
export function statusMeta(status: string, locale: Locale = "en"): BookingStatusMeta {
  const table = locale === "th" ? STATUS_META_TH : STATUS_META_EN;
  return table[status] ?? { label: status.replace(/_/g, " "), color: "var(--status-neutral)" };
}

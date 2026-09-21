// Split out from notifications.ts purely to avoid a circular import: every
// channel module (email.ts, line.ts, whatsapp.ts) needs this type on its
// send functions' return values, and notifications.ts imports those same
// functions — a shared leaf module with no other dependencies breaks the
// cycle.
export type SendResult = "sent" | "skipped" | "failed";

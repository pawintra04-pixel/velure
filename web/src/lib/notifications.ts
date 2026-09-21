import { adminPool } from "@/db/client";
import type { SendResult } from "@/lib/notification-types";
import {
  sendBookingConfirmationEmail,
  sendBookingRescheduledEmail,
  sendBookingCancelledEmail,
  sendBookingReminderEmail,
} from "@/lib/email";
import {
  sendLineBookingConfirmation,
  sendLineBookingRescheduled,
  sendLineBookingCancelled,
  sendLineBookingReminder,
} from "@/lib/line";
import {
  sendWhatsAppBookingConfirmation,
  sendWhatsAppBookingRescheduled,
  sendWhatsAppBookingCancelled,
  sendWhatsAppBookingReminder,
} from "@/lib/whatsapp";

export type NotificationEventType =
  | "booking_confirmed"
  | "booking_rescheduled"
  | "booking_cancelled"
  | "booking_reminder";
export type NotificationChannel = "email" | "line" | "whatsapp";

// The one place every channel plugs into per event type — adding a fourth
// channel later means adding one column here, not finding and editing
// every call site the way email/LINE were wired before this (see
// git log: cancellation/reschedule never reached LINE at all under the
// old direct-call approach, purely because someone had to remember to add
// a second line at every site by hand).
const SENDERS: Record<NotificationEventType, Record<NotificationChannel, (bookingId: string) => Promise<SendResult>>> = {
  booking_confirmed: {
    email: sendBookingConfirmationEmail,
    line: sendLineBookingConfirmation,
    whatsapp: sendWhatsAppBookingConfirmation,
  },
  booking_rescheduled: {
    email: sendBookingRescheduledEmail,
    line: sendLineBookingRescheduled,
    whatsapp: sendWhatsAppBookingRescheduled,
  },
  booking_cancelled: {
    email: sendBookingCancelledEmail,
    line: sendLineBookingCancelled,
    whatsapp: sendWhatsAppBookingCancelled,
  },
  booking_reminder: {
    email: sendBookingReminderEmail,
    line: sendLineBookingReminder,
    whatsapp: sendWhatsAppBookingReminder,
  },
};

const ALL_CHANNELS: NotificationChannel[] = ["email", "line", "whatsapp"];

/**
 * Fans one booking event out to every channel, logging each attempt to
 * notification_log (025_notification_log.sql). Fire-and-forget at the call
 * site exactly like the functions it replaced — never throws, a failure on
 * one channel never blocks another, and neither ever touches booking state.
 *
 * Idempotent: a channel already marked 'sent' for this (booking, event) is
 * skipped before its send function is even called, so calling notify()
 * twice for the same event (a retry, a duplicate webhook delivery) doesn't
 * double-message a customer.
 */
export async function notify(eventType: NotificationEventType, bookingId: string): Promise<void> {
  const { rows: [row] } = await adminPool.query<{ business_id: string }>(
    `SELECT business_id FROM bookings WHERE id = $1`,
    [bookingId]
  );
  const businessId = row?.business_id ?? null;

  for (const channel of ALL_CHANNELS) {
    await attemptChannel(businessId, bookingId, eventType, channel);
  }
}

async function attemptChannel(
  businessId: string | null,
  bookingId: string,
  eventType: NotificationEventType,
  channel: NotificationChannel
): Promise<void> {
  const { rows: [existing] } = await adminPool.query<{ status: SendResult }>(
    `SELECT status FROM notification_log WHERE booking_id = $1 AND event_type = $2 AND channel = $3`,
    [bookingId, eventType, channel]
  );
  if (existing?.status === "sent") return;

  let status: SendResult;
  let error: string | null = null;
  try {
    status = await SENDERS[eventType][channel](bookingId);
  } catch (err) {
    status = "failed";
    error = err instanceof Error ? err.message : String(err);
    console.error(`[notify] ${channel}/${eventType} threw for booking ${bookingId}`, err);
  }

  await adminPool.query(
    `INSERT INTO notification_log (business_id, booking_id, event_type, channel, status, error, attempted_at, retry_count)
     VALUES ($1, $2, $3, $4, $5, $6, now(), 0)
     ON CONFLICT (booking_id, event_type, channel) DO UPDATE
       SET status = EXCLUDED.status, error = EXCLUDED.error, attempted_at = now(),
           retry_count = notification_log.retry_count + 1`,
    [businessId, bookingId, eventType, channel, status, error]
  );
}

/**
 * Called by the retry cron (src/app/api/cron/notification-retry/route.ts)
 * — re-attempts channels still marked 'failed', bounded so a permanently
 * broken channel (e.g. WhatsApp with no approved Template) doesn't retry
 * forever. 'skipped' rows are never retried here: skipped means "nothing
 * to send to" (no email/phone/LINE on file), which a retry can't fix.
 */
const MAX_RETRY_COUNT = 5;

export async function retryFailedNotifications(): Promise<{ attempted: number }> {
  const { rows } = await adminPool.query<{
    business_id: string | null;
    booking_id: string;
    event_type: NotificationEventType;
    channel: NotificationChannel;
  }>(
    `SELECT business_id, booking_id, event_type, channel
     FROM notification_log
     WHERE status = 'failed' AND retry_count < $1
     ORDER BY attempted_at ASC
     LIMIT 100`,
    [MAX_RETRY_COUNT]
  );

  for (const r of rows) {
    await attemptChannel(r.business_id, r.booking_id, r.event_type, r.channel);
  }
  return { attempted: rows.length };
}

/**
 * Called by the daily cron (src/app/api/cron/notification-retry/route.ts —
 * shared with the retry sweep rather than a second cron entry, since
 * Vercel's Hobby plan caps both cron frequency AND job count) to remind
 * customers of an upcoming CONFIRMED booking.
 *
 * The window is 24-48h ahead, not "exactly 24h": a once-daily sweep can't
 * hit an exact offset for every booking regardless of when in the day it
 * starts, so this instead guarantees every booking gets reminded exactly
 * once, sometime 1-2 days out — the best precision available without a
 * finer-grained cron (Hobby plan again). notification_log's UNIQUE
 * constraint is what makes "exactly once" safe to rely on here: a booking
 * still inside the window on a later day's sweep is silently skipped
 * because attemptChannel already sees a 'sent' row for it.
 */
export async function remindUpcomingBookings(): Promise<{ attempted: number }> {
  const { rows } = await adminPool.query<{ id: string }>(
    `SELECT id FROM bookings
     WHERE status = 'CONFIRMED'
       AND start_time BETWEEN now() + interval '24 hours' AND now() + interval '48 hours'`
  );

  for (const r of rows) {
    await notify("booking_reminder", r.id);
  }
  return { attempted: rows.length };
}

/**
 * Called by rescheduleBooking (book/manage/[bookingId]/actions.ts) right
 * after a booking's start_time actually moves — without this, a booking
 * reminded once would never be reminded again for its new time, since
 * notification_log still shows 'sent' for the (booking, booking_reminder,
 * channel) key regardless of which start_time that reminder was about.
 */
export async function clearReminderRecord(bookingId: string): Promise<void> {
  await adminPool.query(
    `DELETE FROM notification_log WHERE booking_id = $1 AND event_type = 'booking_reminder'`,
    [bookingId]
  );
}

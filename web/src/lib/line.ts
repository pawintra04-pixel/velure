import { adminPool } from "@/db/client";
import { formatBaht } from "@/lib/money";
import type { SendResult } from "@/lib/notification-types";

// Same fire-and-forget contract as lib/email.ts: a missing token or a send
// failure must never break the booking flow. Untested against a real LINE
// Official Account — no LINE_MESSAGING_CHANNEL_ACCESS_TOKEN has been
// issued for this project yet, only verified to correctly skip when
// unset and to type-check against LINE's documented API shape.
const channelAccessToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;

function formatBookingTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(iso));
}

type BookingRow = {
  line_user_id: string | null;
  service_name: string;
  staff_name: string;
  start_time: string;
  amount: number;
  business_name: string;
};

async function fetchBookingRow(bookingId: string): Promise<BookingRow | null> {
  const { rows: [row] } = await adminPool.query(
    `SELECT cu.line_user_id, s.name AS service_name, st.name AS staff_name,
            b.start_time, b.amount, biz.name AS business_name
     FROM bookings b
     JOIN services s ON s.id = b.service_id
     JOIN staff st ON st.id = b.staff_id
     JOIN businesses biz ON biz.id = b.business_id
     LEFT JOIN customers cu ON cu.id = b.customer_id
     WHERE b.id = $1`,
    [bookingId]
  );
  return row ?? null;
}

/** Raw push — https://developers.line.biz/en/reference/messaging-api/#send-push-message */
async function pushLineMessage(lineUserId: string, text: string): Promise<SendResult> {
  if (!channelAccessToken) {
    console.log(`[line] LINE_MESSAGING_CHANNEL_ACCESS_TOKEN not set — skipping message to ${lineUserId}`);
    return "skipped";
  }
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text }] }),
    });
    if (!res.ok) {
      console.error(`[line] push failed (${res.status}) for ${lineUserId}`, await res.text());
      return "failed";
    }
    return "sent";
  } catch (err) {
    console.error(`[line] push failed for ${lineUserId}`, err);
    return "failed";
  }
}

/**
 * Shared by all three event functions below: fetches everything needed by
 * booking id via adminPool (no business context exists yet at any of this
 * module's call sites) and sends only if the customer has connected their
 * LINE account (customers.line_user_id — see /api/line/connect and
 * /api/line/callback for how that gets set).
 */
async function sendLineBookingEvent(bookingId: string, buildText: (row: BookingRow) => string): Promise<SendResult> {
  try {
    const row = await fetchBookingRow(bookingId);
    if (!row || !row.line_user_id) {
      console.log(`[line] no connected LINE account for booking ${bookingId} — skipping`);
      return "skipped";
    }
    return await pushLineMessage(row.line_user_id, buildText(row));
  } catch (err) {
    console.error(`[line] failed to send event for booking ${bookingId}`, err);
    return "failed";
  }
}

export async function sendLineBookingConfirmation(bookingId: string): Promise<SendResult> {
  return sendLineBookingEvent(bookingId, (row) => {
    const time = formatBookingTime(row.start_time);
    const amountLine = row.amount > 0 ? `\nAmount paid: ${formatBaht(row.amount)}` : "";
    return `Booking confirmed at ${row.business_name}\n${row.service_name} with ${row.staff_name}\n${time}${amountLine}`;
  });
}

export async function sendLineBookingRescheduled(bookingId: string): Promise<SendResult> {
  return sendLineBookingEvent(bookingId, (row) => {
    const time = formatBookingTime(row.start_time);
    return `Your booking at ${row.business_name} was moved\n${row.service_name} with ${row.staff_name}\nNew time: ${time}`;
  });
}

export async function sendLineBookingCancelled(bookingId: string): Promise<SendResult> {
  return sendLineBookingEvent(bookingId, (row) => {
    const time = formatBookingTime(row.start_time);
    return `Booking cancelled at ${row.business_name}\n${row.service_name} — was scheduled for ${time}`;
  });
}

export async function sendLineBookingReminder(bookingId: string): Promise<SendResult> {
  return sendLineBookingEvent(bookingId, (row) => {
    const time = formatBookingTime(row.start_time);
    return `Reminder: ${row.service_name} at ${row.business_name}\nWith ${row.staff_name}\n${time}`;
  });
}

// Keyed by waitlist_entries.id, not a booking — see lib/waitlist.ts.
export async function sendLineWaitlistInvite(waitlistEntryId: string): Promise<SendResult> {
  try {
    const { rows: [row] } = await adminPool.query(
      `SELECT cu.line_user_id, s.id AS service_id, s.name AS service_name,
              w.target_date, biz.name AS business_name, biz.slug AS business_slug
       FROM waitlist_entries w
       JOIN services s ON s.id = w.service_id
       JOIN businesses biz ON biz.id = w.business_id
       LEFT JOIN customers cu ON cu.id = w.customer_id
       WHERE w.id = $1`,
      [waitlistEntryId]
    );
    if (!row || !row.line_user_id) {
      console.log(`[line] no connected LINE account for waitlist entry ${waitlistEntryId} — skipping`);
      return "skipped";
    }
    const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
    const dateLabel = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", dateStyle: "long" }).format(
      new Date(`${row.target_date}T00:00:00+07:00`)
    );
    return await pushLineMessage(
      row.line_user_id,
      `A spot opened up at ${row.business_name}\n${row.service_name} on ${dateLabel}\nBook now (first-come-first-served):\n${baseUrl}/book/${row.business_slug}/${row.service_id}`
    );
  } catch (err) {
    console.error(`[line] failed to send waitlist invite ${waitlistEntryId}`, err);
    return "failed";
  }
}

import { adminPool } from "@/db/client";
import { formatBaht } from "@/lib/money";

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

/** Raw push — https://developers.line.biz/en/reference/messaging-api/#send-push-message */
async function pushLineMessage(lineUserId: string, text: string): Promise<void> {
  if (!channelAccessToken) {
    console.log(`[line] LINE_MESSAGING_CHANNEL_ACCESS_TOKEN not set — skipping message to ${lineUserId}`);
    return;
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
    }
  } catch (err) {
    console.error(`[line] push failed for ${lineUserId}`, err);
  }
}

/**
 * Same shape as sendBookingConfirmationEmail: fetches everything needed by
 * booking id via adminPool (no business context exists yet at either of
 * this function's call sites) and sends only if the customer has
 * connected their LINE account (customers.line_user_id — see
 * /api/line/connect and /api/line/callback for how that gets set).
 */
export async function sendLineBookingConfirmation(bookingId: string): Promise<void> {
  if (!channelAccessToken) {
    console.log(`[line] LINE_MESSAGING_CHANNEL_ACCESS_TOKEN not set — skipping confirmation for ${bookingId}`);
    return;
  }

  try {
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

    if (!row || !row.line_user_id) {
      console.log(`[line] no connected LINE account for booking ${bookingId} — skipping`);
      return;
    }

    const time = formatBookingTime(row.start_time);
    const amountLine = row.amount > 0 ? `\nAmount paid: ${formatBaht(row.amount)}` : "";
    const text = `Booking confirmed at ${row.business_name}\n${row.service_name} with ${row.staff_name}\n${time}${amountLine}`;

    await pushLineMessage(row.line_user_id, text);
  } catch (err) {
    console.error(`[line] failed to send confirmation for booking ${bookingId}`, err);
  }
}

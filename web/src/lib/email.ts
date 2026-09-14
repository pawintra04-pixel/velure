import { Resend } from "resend";
import { adminPool } from "@/db/client";
import { formatBaht } from "@/lib/money";

// A missing key or a send failure must never break the booking flow — the
// booking is already real (paid or confirmed) by the time this runs. Every
// call site treats this as fire-and-forget: log and move on, don't throw.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// resend.dev requires no domain verification, so this works immediately in
// dev/test — swap for a verified sending domain (RESEND_FROM_EMAIL) once
// the business has one, or every email lands with "via resend.dev" in it.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "Velure <onboarding@resend.dev>";
const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";

function formatBookingTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(iso));
}

/**
 * Fire-and-forget: fetches everything needed by booking id (adminPool —
 * same legitimate cross-tenant-lookup case as the Stripe webhook, see
 * db/client.ts) and sends a confirmation email if the customer has one on
 * file. Safe to call from both the free-booking instant-confirm path and
 * the Stripe webhook handler.
 */
export async function sendBookingConfirmationEmail(bookingId: string): Promise<void> {
  if (!resend) {
    console.log(`[email] RESEND_API_KEY not set — skipping confirmation email for ${bookingId}`);
    return;
  }

  try {
    const { rows: [row] } = await adminPool.query(
      `SELECT
         cu.name AS customer_name, cu.email AS customer_email,
         s.name AS service_name, st.name AS staff_name,
         b.start_time, b.amount, biz.name AS business_name
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN staff st ON st.id = b.staff_id
       JOIN businesses biz ON biz.id = b.business_id
       LEFT JOIN customers cu ON cu.id = b.customer_id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (!row || !row.customer_email) {
      console.log(`[email] no customer email on file for booking ${bookingId} — skipping`);
      return;
    }

    const time = formatBookingTime(row.start_time);
    const amountLine = row.amount > 0 ? `<p>Amount paid: <strong>${formatBaht(row.amount)}</strong></p>` : "";
    const manageUrl = `${APP_BASE_URL}/book/manage/${bookingId}`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: row.customer_email,
      subject: `Booking confirmed — ${row.service_name} at ${row.business_name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Booking confirmed</h2>
          <p>Hi ${row.customer_name ?? "there"}, your booking at ${row.business_name} is confirmed.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 6px 0; color: #666;">Service</td><td style="padding: 6px 0;">${row.service_name}</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Staff</td><td style="padding: 6px 0;">${row.staff_name}</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Time</td><td style="padding: 6px 0;">${time}</td></tr>
          </table>
          ${amountLine}
          <p><a href="${manageUrl}">Need to reschedule or cancel?</a></p>
          <p style="color: #888; font-size: 13px;">This is an automated confirmation from Velure.</p>
        </div>
      `,
    });
    console.log(`[email] sent confirmation for booking ${bookingId} to ${row.customer_email}`);
  } catch (err) {
    console.error(`[email] failed to send confirmation for booking ${bookingId}`, err);
  }
}

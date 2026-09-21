import { Resend } from "resend";
import { adminPool } from "@/db/client";
import { formatBaht } from "@/lib/money";
import type { SendResult } from "@/lib/notification-types";

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
export async function sendBookingConfirmationEmail(bookingId: string): Promise<SendResult> {
  if (!resend) {
    console.log(`[email] RESEND_API_KEY not set — skipping confirmation email for ${bookingId}`);
    return "skipped";
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
      return "skipped";
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
    return "sent";
  } catch (err) {
    console.error(`[email] failed to send confirmation for booking ${bookingId}`, err);
    return "failed";
  }
}

/**
 * Same fire-and-forget shape as sendBookingConfirmationEmail — called after
 * a reschedule has already committed (public self-service flow), so the
 * new start_time on the row is the one this reads and reports. A failure
 * here only means the customer doesn't get an email; the booking itself is
 * already moved.
 */
export async function sendBookingRescheduledEmail(bookingId: string): Promise<SendResult> {
  if (!resend) {
    console.log(`[email] RESEND_API_KEY not set — skipping reschedule email for ${bookingId}`);
    return "skipped";
  }

  try {
    const { rows: [row] } = await adminPool.query(
      `SELECT
         cu.name AS customer_name, cu.email AS customer_email,
         s.name AS service_name, st.name AS staff_name,
         b.start_time, biz.name AS business_name
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN staff st ON st.id = b.staff_id
       JOIN businesses biz ON biz.id = b.business_id
       LEFT JOIN customers cu ON cu.id = b.customer_id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (!row || !row.customer_email) {
      console.log(`[email] no customer email on file for booking ${bookingId} — skipping reschedule email`);
      return "skipped";
    }

    const time = formatBookingTime(row.start_time);
    const manageUrl = `${APP_BASE_URL}/book/manage/${bookingId}`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: row.customer_email,
      subject: `Booking moved — ${row.service_name} at ${row.business_name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Your booking was moved</h2>
          <p>Hi ${row.customer_name ?? "there"}, your booking at ${row.business_name} is now at a new time.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 6px 0; color: #666;">Service</td><td style="padding: 6px 0;">${row.service_name}</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Staff</td><td style="padding: 6px 0;">${row.staff_name}</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">New time</td><td style="padding: 6px 0;"><strong>${time}</strong></td></tr>
          </table>
          <p><a href="${manageUrl}">Need to change it again?</a></p>
          <p style="color: #888; font-size: 13px;">This is an automated notice from Velure.</p>
        </div>
      `,
    });
    console.log(`[email] sent reschedule notice for booking ${bookingId} to ${row.customer_email}`);
    return "sent";
  } catch (err) {
    console.error(`[email] failed to send reschedule notice for booking ${bookingId}`, err);
    return "failed";
  }
}

/**
 * Same shape again, for a booking that just moved to CANCELLED — called
 * from both the customer's own self-service cancel and the owner
 * cancelling it from the dashboard, since either one is a real
 * cancellation the customer should hear about.
 */
export async function sendBookingCancelledEmail(bookingId: string): Promise<SendResult> {
  if (!resend) {
    console.log(`[email] RESEND_API_KEY not set — skipping cancellation email for ${bookingId}`);
    return "skipped";
  }

  try {
    const { rows: [row] } = await adminPool.query(
      `SELECT
         cu.name AS customer_name, cu.email AS customer_email,
         s.name AS service_name, b.start_time, b.amount, biz.name AS business_name
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN businesses biz ON biz.id = b.business_id
       LEFT JOIN customers cu ON cu.id = b.customer_id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (!row || !row.customer_email) {
      console.log(`[email] no customer email on file for booking ${bookingId} — skipping cancellation email`);
      return "skipped";
    }

    const time = formatBookingTime(row.start_time);
    const refundLine =
      row.amount > 0
        ? `<p style="color: #888; font-size: 13px;">If you paid for this booking, contact ${row.business_name} about a refund — cancelling doesn't refund automatically.</p>`
        : "";

    await resend.emails.send({
      from: FROM_EMAIL,
      to: row.customer_email,
      subject: `Booking cancelled — ${row.service_name} at ${row.business_name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Booking cancelled</h2>
          <p>Hi ${row.customer_name ?? "there"}, your booking at ${row.business_name} has been cancelled.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 6px 0; color: #666;">Service</td><td style="padding: 6px 0;">${row.service_name}</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Was scheduled for</td><td style="padding: 6px 0;">${time}</td></tr>
          </table>
          ${refundLine}
          <p style="color: #888; font-size: 13px;">This is an automated notice from Velure.</p>
        </div>
      `,
    });
    console.log(`[email] sent cancellation notice for booking ${bookingId} to ${row.customer_email}`);
    return "sent";
  } catch (err) {
    console.error(`[email] failed to send cancellation notice for booking ${bookingId}`, err);
    return "failed";
  }
}

/**
 * Same shape again, for the reminder sweep (see notifications.ts's
 * remindUpcomingBookings, called by the daily cron). Reminder is a
 * one-time event per booking per the notification_log UNIQUE constraint —
 * rescheduleBooking clears any prior 'booking_reminder' row so a moved
 * booking gets reminded again relative to its new time.
 */
export async function sendBookingReminderEmail(bookingId: string): Promise<SendResult> {
  if (!resend) {
    console.log(`[email] RESEND_API_KEY not set — skipping reminder email for ${bookingId}`);
    return "skipped";
  }

  try {
    const { rows: [row] } = await adminPool.query(
      `SELECT
         cu.name AS customer_name, cu.email AS customer_email,
         s.name AS service_name, st.name AS staff_name,
         b.start_time, biz.name AS business_name
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN staff st ON st.id = b.staff_id
       JOIN businesses biz ON biz.id = b.business_id
       LEFT JOIN customers cu ON cu.id = b.customer_id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (!row || !row.customer_email) {
      console.log(`[email] no customer email on file for booking ${bookingId} — skipping reminder email`);
      return "skipped";
    }

    const time = formatBookingTime(row.start_time);
    const manageUrl = `${APP_BASE_URL}/book/manage/${bookingId}`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: row.customer_email,
      subject: `Reminder — ${row.service_name} at ${row.business_name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>See you soon</h2>
          <p>Hi ${row.customer_name ?? "there"}, this is a reminder about your upcoming booking at ${row.business_name}.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 6px 0; color: #666;">Service</td><td style="padding: 6px 0;">${row.service_name}</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Staff</td><td style="padding: 6px 0;">${row.staff_name}</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Time</td><td style="padding: 6px 0;">${time}</td></tr>
          </table>
          <p><a href="${manageUrl}">Need to reschedule or cancel?</a></p>
          <p style="color: #888; font-size: 13px;">This is an automated reminder from Velure.</p>
        </div>
      `,
    });
    console.log(`[email] sent reminder for booking ${bookingId} to ${row.customer_email}`);
    return "sent";
  } catch (err) {
    console.error(`[email] failed to send reminder for booking ${bookingId}`, err);
    return "failed";
  }
}

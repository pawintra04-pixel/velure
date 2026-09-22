import type { PoolClient } from "pg";
import { withBusinessContext } from "@/db/client";
import { sendWaitlistInviteEmail } from "@/lib/email";
import { sendWhatsAppWaitlistInvite } from "@/lib/whatsapp";
import { sendLineWaitlistInvite } from "@/lib/line";

export type JoinWaitlistResult = { ok: true } | { ok: false; error: string };

/**
 * Public, unauthenticated entry point — same shape as book/actions.ts's
 * completeBookingDetails: upsert into customers keyed on (business_id,
 * phone), then attach a waitlist row. No payment step, nothing reserved.
 */
export async function joinWaitlist(input: {
  businessId: string;
  serviceId: string;
  targetDate: string; // "yyyy-mm-dd", already Bangkok-local (from the date picker)
  customerName: string;
  customerPhone: string;
  customerEmail: string;
}): Promise<JoinWaitlistResult> {
  const { businessId, serviceId, targetDate, customerName, customerPhone, customerEmail } = input;
  if (!customerName.trim() || !customerPhone.trim()) {
    return { ok: false, error: "Name and phone are required." };
  }

  await withBusinessContext(businessId, async (c) => {
    const { rows: [customer] } = await c.query(
      `INSERT INTO customers (business_id, name, phone, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (business_id, phone) WHERE phone IS NOT NULL
       DO UPDATE SET name = EXCLUDED.name, email = COALESCE(EXCLUDED.email, customers.email)
       RETURNING id`,
      [businessId, customerName.trim(), customerPhone.trim(), customerEmail.trim() || null]
    );

    await c.query(
      `INSERT INTO waitlist_entries (business_id, service_id, customer_id, target_date)
       VALUES ($1, $2, $3, $4)`,
      [businessId, serviceId, customer.id, targetDate]
    );
  });

  return { ok: true };
}

/**
 * Called fire-and-forget, post-commit, right next to notify() at every
 * place a booking leaves an active status for a given service+date — a
 * cancellation is itself the proof a slot opened, so this doesn't re-run
 * the availability engine, it just claims the longest-waiting matching
 * entry and invites them back. Never blocks or fails the cancellation it's
 * called from: every step below is best-effort.
 *
 * The claim is atomic (FOR UPDATE SKIP LOCKED inside a single UPDATE), so
 * two cancellations landing at the same moment for the same service+date
 * can't both grab the same waiting entry.
 */
export async function checkWaitlistForCancelledSlot(
  businessId: string,
  serviceId: string,
  cancelledStartTimeISO: string
): Promise<void> {
  try {
    const claimed = await withBusinessContext(businessId, async (c) => {
      const { rows: [row] } = await c.query<{ id: string; customer_id: string }>(
        `UPDATE waitlist_entries
         SET status = 'notified', notified_at = now()
         WHERE id = (
           SELECT id FROM waitlist_entries
           WHERE business_id = $1 AND service_id = $2 AND status = 'waiting'
             AND target_date = ($3::timestamptz AT TIME ZONE 'Asia/Bangkok')::date
           ORDER BY created_at ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING id, customer_id`,
        [businessId, serviceId, cancelledStartTimeISO]
      );
      return row ?? null;
    });

    if (!claimed) return;

    const channelsSent = await sendInviteAllChannels(claimed.id);
    if (channelsSent.length > 0) {
      await withBusinessContext(businessId, (c) =>
        c.query(`UPDATE waitlist_entries SET notified_channels = $1 WHERE id = $2`, [
          channelsSent,
          claimed.id,
        ])
      );
    }
  } catch (err) {
    // A failure here must never surface to (or undo) the cancellation that
    // triggered it — same fire-and-forget contract as notify().
    console.error(`[waitlist] checkWaitlistForCancelledSlot failed for service ${serviceId}`, err);
  }
}

async function sendInviteAllChannels(waitlistEntryId: string): Promise<string[]> {
  const sent: string[] = [];
  if ((await sendWaitlistInviteEmail(waitlistEntryId)) === "sent") sent.push("email");
  if ((await sendWhatsAppWaitlistInvite(waitlistEntryId)) === "sent") sent.push("whatsapp");
  if ((await sendLineWaitlistInvite(waitlistEntryId)) === "sent") sent.push("line");
  return sent;
}

export type WaitlistEntryRow = {
  id: string;
  serviceName: string;
  customerName: string;
  customerPhone: string | null;
  targetDate: string;
  status: "waiting" | "notified" | "cancelled";
  notifiedAt: string | null;
  notifiedChannels: string[] | null;
  createdAt: string;
};

export async function listWaitlistEntries(businessId: string): Promise<WaitlistEntryRow[]> {
  return withBusinessContext(businessId, async (c) => {
    const { rows } = await c.query(
      `SELECT w.id, s.name AS service_name, cu.name AS customer_name, cu.phone AS customer_phone,
              w.target_date, w.status, w.notified_at, w.notified_channels, w.created_at
       FROM waitlist_entries w
       JOIN services s ON s.id = w.service_id
       JOIN customers cu ON cu.id = w.customer_id
       WHERE w.status != 'cancelled'
       ORDER BY (w.status = 'waiting') DESC, w.target_date, w.created_at`
    );
    return rows.map((r) => ({
      id: r.id,
      serviceName: r.service_name,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      targetDate: r.target_date,
      status: r.status,
      notifiedAt: r.notified_at,
      notifiedChannels: r.notified_channels,
      createdAt: r.created_at,
    }));
  });
}

export async function cancelWaitlistEntry(c: PoolClient, waitlistEntryId: string): Promise<void> {
  await c.query(`UPDATE waitlist_entries SET status = 'cancelled' WHERE id = $1`, [waitlistEntryId]);
}

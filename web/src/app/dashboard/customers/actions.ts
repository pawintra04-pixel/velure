"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { redeemPackageSession } from "@/lib/packages";
import { isStaffFreeForRange, isSlotConflictError } from "@/lib/staff-availability";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export async function updateCustomerNotes(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();
  const customerId = String(formData.get("customerId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  await withBusinessContext(owner.businessId, (c) =>
    c.query(`UPDATE customers SET notes = $1 WHERE id = $2`, [notes || null, customerId])
  );

  revalidatePath(`/dashboard/customers/${customerId}`);
  return { ok: true, message: "Notes saved" };
}

// One tag per line in the textarea — deliberately not a comma-split (tags
// like "prefers afternoon, no evenings" would otherwise get mangled into
// two tags). Trimmed and empties dropped; duplicates collapse naturally
// since tags are just an unordered set an owner is scanning, not a
// counted/ordered list.
export async function updateCustomerTags(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();
  const customerId = String(formData.get("customerId") ?? "");
  const tagsRaw = String(formData.get("tags") ?? "");
  const tags = [...new Set(tagsRaw.split("\n").map((t) => t.trim()).filter(Boolean))];

  await withBusinessContext(owner.businessId, (c) =>
    c.query(`UPDATE customers SET tags = $1 WHERE id = $2`, [tags, customerId])
  );

  revalidatePath(`/dashboard/customers/${customerId}`);
  revalidatePath("/dashboard/customers");
  return { ok: true, message: "Tags saved" };
}

// Sold in person — see 029_packages.sql and lib/packages.ts's comment for
// why this doesn't run a new Stripe charge. price_paid_amount is recorded
// as typed by the owner (not re-derived from the package's list price),
// so a discount given at the counter still shows accurately in reports.
export async function sellPackage(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();
  const customerId = String(formData.get("customerId") ?? "");
  const packageId = String(formData.get("packageId") ?? "");
  const paymentMethod = String(formData.get("paymentMethod") ?? "cash");

  if (!customerId || !packageId) {
    return { ok: false, error: "Missing customer or package." };
  }
  if (!["cash", "card", "promptpay", "other"].includes(paymentMethod)) {
    return { ok: false, error: "Invalid payment method." };
  }

  await withBusinessContext(owner.businessId, async (c) => {
    const { rows: [pkg] } = await c.query<{
      session_count: number;
      price_amount: number;
      validity_days: number | null;
    }>(`SELECT session_count, price_amount, validity_days FROM packages WHERE id = $1`, [packageId]);
    if (!pkg) throw new Error("package_not_found");

    const expiresAt = pkg.validity_days
      ? new Date(Date.now() + pkg.validity_days * 24 * 60 * 60 * 1000)
      : null;

    await c.query(
      `INSERT INTO package_purchases
         (business_id, package_id, customer_id, sessions_total, sessions_remaining, price_paid_amount, payment_method, expires_at)
       VALUES ($1, $2, $3, $4, $4, $5, $6, $7)`,
      [owner.businessId, packageId, customerId, pkg.session_count, pkg.price_amount, paymentMethod, expiresAt]
    );
  });

  revalidatePath(`/dashboard/customers/${customerId}`);
  return { ok: true, message: "Package sold" };
}

/**
 * Redeems one session from a package and creates the CONFIRMED booking in
 * the same transaction — the redeem (atomic compare-and-swap, see
 * lib/packages.ts) and the booking's own overlap EXCLUDE constraint are
 * each real guards on their own; doing both together means either both
 * succeed or neither does, never a session lost with no booking to show
 * for it.
 */
export async function bookFromPackage(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();
  const customerId = String(formData.get("customerId") ?? "");
  const packagePurchaseId = String(formData.get("packagePurchaseId") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  const dateISO = String(formData.get("date") ?? "");
  const timeHHMM = String(formData.get("time") ?? "");

  if (!customerId || !packagePurchaseId || !serviceId || !dateISO || !timeHHMM) {
    return { ok: false, error: "Date and time are required." };
  }

  try {
    await withBusinessContext(owner.businessId, async (c) => {
      const { rows: [service] } = await c.query<{ duration_minutes: number; buffer_minutes: number }>(
        `SELECT duration_minutes, buffer_minutes FROM services WHERE id = $1`,
        [serviceId]
      );
      if (!service) throw new Error("service_not_found");

      const { rows: [assignment] } = await c.query<{ staff_id: string }>(
        `SELECT staff_id FROM staff_services WHERE service_id = $1 LIMIT 1`,
        [serviceId]
      );
      if (!assignment) throw new Error("no_staff_assigned");

      const startTime = new Date(`${dateISO}T${timeHHMM}:00+07:00`);
      const endTime = new Date(
        startTime.getTime() + (service.duration_minutes + service.buffer_minutes) * 60_000
      );

      if (!(await isStaffFreeForRange(c, assignment.staff_id, startTime.toISOString(), endTime.toISOString()))) {
        throw new Error("slot_taken");
      }

      const redeemed = await redeemPackageSession(c, packagePurchaseId);
      if (!redeemed) throw new Error("no_sessions_left");

      await c.query(
        `INSERT INTO bookings
           (business_id, service_id, staff_id, customer_id, start_time, end_time, status, amount, created_by_staff, package_purchase_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED', 0, true, $7)`,
        [owner.businessId, serviceId, assignment.staff_id, customerId, startTime.toISOString(), endTime.toISOString(), packagePurchaseId]
      );
    });
  } catch (err) {
    if (isSlotConflictError(err) || (err as Error).message === "slot_taken") {
      return { ok: false, error: "That staff member already has something scheduled at this time." };
    }
    if ((err as Error).message === "no_sessions_left") {
      return { ok: false, error: "This package has no sessions left — please refresh and try again." };
    }
    console.error("bookFromPackage failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath(`/dashboard/customers/${customerId}`);
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  return { ok: true, message: "Booked" };
}

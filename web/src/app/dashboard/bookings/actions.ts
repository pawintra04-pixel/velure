"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { releaseClassSeat } from "@/lib/classes";
import { restorePackageSession } from "@/lib/packages";
import { isStaffFreeForRange, isSlotConflictError } from "@/lib/staff-availability";
import { stripe } from "@/lib/stripe";
import { notify } from "@/lib/notifications";
import { checkWaitlistForCancelledSlot } from "@/lib/waitlist";

export type ManualBookingResult = { ok: true } | { ok: false; error: string };

const MANUAL_PAYMENT_STATUSES = ["paid", "unpaid", "deposit", "free"] as const;
type ManualPaymentStatus = (typeof MANUAL_PAYMENT_STATUSES)[number];

export type RefundResult = { ok: true; message?: string } | { ok: false; error: string };

const REFUNDABLE_STATUSES = ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];

type RefundLookup = {
  kind: "stripe" | "package" | "cash";
  paymentIntentId: string | null;
  stripeAccountId: string | null;
  packagePurchaseId: string | null;
  bookingAmount: number;
  status: string;
  classSessionId: string | null;
};

/**
 * Deliberately manual, not automatic on cancel — refund policy varies by
 * business (deposit forfeited? full refund inside 24h? case by case?) and
 * this app doesn't model one, so an owner decides per booking rather than
 * money moving without a human choosing to move it. One refund per
 * booking in this pass (full or partial) — no support yet for issuing a
 * second partial refund on top of a first.
 *
 * Branches on the booking's own data — never trusts the client to say
 * which kind of refund this is:
 * - stripe_payment_intent_id set -> real Stripe refund (unchanged from
 *   before this comment; the original behavior).
 * - no Stripe intent but package_purchase_id set -> the booking was paid
 *   for by redeeming a package session, not a Stripe charge, so "refund"
 *   means restoring that session (restorePackageSession, the same call
 *   cancellation already makes) — full only, no partial amount concept
 *   since no money moved through this app for it.
 * - neither -> paid in person (cash) outside Stripe. Nothing to call out
 *   to; this just records that the owner handed money back, same
 *   full/partial shape as the Stripe path minus the API call.
 */
export async function refundBooking(bookingId: string, amountBaht: number | null): Promise<RefundResult> {
  const owner = await requireOwner();

  let lookup: RefundLookup;
  try {
    lookup = await withBusinessContext(owner.businessId, async (c) => {
      const { rows: [booking] } = await c.query<{
        stripe_payment_intent_id: string | null;
        package_purchase_id: string | null;
        amount: number;
        amount_paid: number | null;
        status: string;
        stripe_account_id: string | null;
        class_session_id: string | null;
      }>(
        `SELECT b.stripe_payment_intent_id, b.package_purchase_id, b.amount, b.amount_paid, b.status,
                b.class_session_id, biz.stripe_account_id
         FROM bookings b JOIN businesses biz ON biz.id = b.business_id
         WHERE b.id = $1`,
        [bookingId]
      );
      if (!booking) throw new Error("no_payment");
      if (!REFUNDABLE_STATUSES.includes(booking.status)) throw new Error("not_refundable");

      if (booking.stripe_payment_intent_id) {
        if (!booking.stripe_account_id) throw new Error("no_payment");
        return {
          kind: "stripe" as const,
          paymentIntentId: booking.stripe_payment_intent_id,
          stripeAccountId: booking.stripe_account_id,
          packagePurchaseId: null,
          bookingAmount: booking.amount,
          status: booking.status,
          classSessionId: booking.class_session_id,
        };
      }
      if (booking.package_purchase_id) {
        return {
          kind: "package" as const,
          paymentIntentId: null,
          stripeAccountId: null,
          packagePurchaseId: booking.package_purchase_id,
          bookingAmount: booking.amount,
          status: booking.status,
          classSessionId: booking.class_session_id,
        };
      }
      // A staff-created booking tracks what's actually been collected
      // (amount_paid) — only that much can be handed back, not the full
      // price of a booking the customer never paid for (or only paid a
      // deposit on). NULL means untracked: the original cash-checkout path.
      const collected = booking.amount_paid ?? booking.amount;
      if (collected <= 0) throw new Error("no_payment");
      return {
        kind: "cash" as const,
        paymentIntentId: null,
        stripeAccountId: null,
        packagePurchaseId: null,
        bookingAmount: collected,
        status: booking.status,
        classSessionId: booking.class_session_id,
      };
    });
  } catch (err) {
    if ((err as Error).message === "no_payment") {
      return { ok: false, error: "This booking has no payment to refund." };
    }
    if ((err as Error).message === "not_refundable") {
      return { ok: false, error: "This booking can't be refunded from its current status." };
    }
    console.error("refundBooking lookup failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  const { kind, paymentIntentId, stripeAccountId, packagePurchaseId, bookingAmount, status: originalStatus, classSessionId } = lookup;

  // Package restores are always full (a redeemed session is a single unit,
  // not a partial amount) — any amountBaht the client sent is ignored for
  // this kind, same principle as the branch above: the server decides.
  const refundAmountSatang = kind !== "package" && amountBaht != null ? Math.round(amountBaht * 100) : undefined;
  if (kind !== "package" && refundAmountSatang !== undefined && (refundAmountSatang <= 0 || refundAmountSatang > bookingAmount)) {
    return { ok: false, error: "Refund amount must be between 0 and the amount paid." };
  }

  if (kind === "stripe") {
    try {
      // Idempotency key scoped to this exact booking + amount — a double
      // click or a retried request for the same refund reaches Stripe as
      // the same request instead of two separate refunds; a genuinely
      // different amount (e.g. full after a partial) gets its own key.
      await stripe.refunds.create(
        { payment_intent: paymentIntentId!, ...(refundAmountSatang !== undefined ? { amount: refundAmountSatang } : {}) },
        { stripeAccount: stripeAccountId!, idempotencyKey: `refund_${bookingId}_${refundAmountSatang ?? "full"}` }
      );
    } catch (err) {
      console.error("Stripe refund failed", err);
      return { ok: false, error: "Stripe refused the refund. Check the payment in your Stripe dashboard." };
    }
  }

  const isFull = kind === "package" || refundAmountSatang === undefined || refundAmountSatang === bookingAmount;
  const refundedAmountToRecord = kind === "package" ? null : (refundAmountSatang ?? bookingAmount);

  await withBusinessContext(owner.businessId, async (c) => {
    // Guarded on the status this refund was validated against, the same
    // "compare-and-swap" shape as updateBookingStatus — if a concurrent
    // request already moved this booking to REFUNDED/PARTIALLY_REFUNDED
    // (e.g. a race between two rapid clicks, both passing Stripe's
    // idempotency check as the same call), this UPDATE affects 0 rows and
    // the seat/package session is correctly released at most once.
    const { rows: [updated] } = await c.query(
      `UPDATE bookings SET status = $1, refunded_amount = $2, refunded_at = now()
       WHERE id = $3 AND status = $4 RETURNING id`,
      [isFull ? "REFUNDED" : "PARTIALLY_REFUNDED", refundedAmountToRecord, bookingId, originalStatus]
    );
    if (!updated) return;

    if (kind === "package" && packagePurchaseId) {
      await restorePackageSession(c, packagePurchaseId);
    }
    // A full refund of a still-CONFIRMED class seat is the refund-triggered
    // equivalent of a cancellation (money/session is fully back, so the
    // seat should be resellable) — mirrors updateBookingStatus's CANCELLED
    // handling. Skip CANCELLED/NO_SHOW originals: CANCELLED already
    // released its seat, and NO_SHOW/COMPLETED sessions are in the past and
    // don't affect future capacity, so releasing again would
    // double-decrement seats_booked.
    if (isFull && originalStatus === "CONFIRMED" && classSessionId) {
      await releaseClassSeat(c, classSessionId);
    }
  });

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/reports");
  return {
    ok: true,
    message: kind === "package" ? "Package session restored" : isFull ? "Refund issued" : "Partial refund issued",
  };
}

/**
 * Staff take bookings by phone/LINE/walk-in no matter what online flow
 * exists — this lets that go straight into the same availability engine
 * instead of living outside it (which is the only way Velure can actually
 * keep its double-booking guarantee: it only holds if every path a
 * booking can enter through respects it). Skips the online hold->pay
 * flow entirely and goes straight to CONFIRMED, since a staff member
 * creating this is presumed to be handling payment themselves in person.
 */
export async function createManualBooking(
  _prev: ManualBookingResult | null,
  formData: FormData
): Promise<ManualBookingResult> {
  const owner = await requireOwner();

  const serviceId = String(formData.get("serviceId") ?? "");
  const staffId = String(formData.get("staffId") ?? "");
  const dateISO = String(formData.get("date") ?? "");
  const timeHHMM = String(formData.get("time") ?? "");
  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const customerEmail = String(formData.get("customerEmail") ?? "").trim();
  const paymentStatusRaw = String(formData.get("paymentStatus") ?? "unpaid");
  const paymentStatus: ManualPaymentStatus = (MANUAL_PAYMENT_STATUSES as readonly string[]).includes(paymentStatusRaw)
    ? (paymentStatusRaw as ManualPaymentStatus)
    : "unpaid";
  const depositPaidBaht = Number(formData.get("depositPaidBaht") ?? "");
  const paymentNote = String(formData.get("paymentNote") ?? "").trim().slice(0, 200);

  if (!serviceId || !staffId || !dateISO || !timeHHMM || !customerName || !customerPhone) {
    return { ok: false, error: "Service, staff, date/time, customer name and phone are all required." };
  }
  if (paymentStatus === "deposit" && (!Number.isFinite(depositPaidBaht) || depositPaidBaht <= 0)) {
    return { ok: false, error: "Enter how much deposit the customer paid." };
  }

  try {
    await withBusinessContext(owner.businessId, async (c) => {
      const { rows: [service] } = await c.query<{
        duration_minutes: number;
        buffer_minutes: number;
        price_amount: number;
        payment_mode: string;
        deposit_amount: number | null;
        deposit_percent: number | null;
      }>(
        `SELECT duration_minutes, buffer_minutes, price_amount, payment_mode, deposit_amount, deposit_percent
         FROM services WHERE id = $1`,
        [serviceId]
      );
      if (!service) throw new Error("service_not_found");

      const startTime = new Date(`${dateISO}T${timeHHMM}:00+07:00`);
      const endTime = new Date(
        startTime.getTime() + (service.duration_minutes + service.buffer_minutes) * 60_000
      );

      if (!(await isStaffFreeForRange(c, staffId, startTime.toISOString(), endTime.toISOString()))) {
        throw new Error("slot_taken");
      }

      // `amount` is what this booking is worth (what Reports count);
      // `amountPaid` is how much of it the customer has actually handed
      // over so far — the owner can mark the rest as received later from
      // the booking row (markBookingPaid). A "free" service is always worth
      // 0 regardless of what the owner picked.
      const amount = paymentStatus === "free" || service.payment_mode === "free" ? 0 : service.price_amount;
      const depositPaid = Math.round(depositPaidBaht * 100);
      if (paymentStatus === "deposit" && depositPaid >= amount) throw new Error("deposit_too_large");
      const amountPaid =
        paymentStatus === "paid" ? amount : paymentStatus === "deposit" ? depositPaid : 0;

      const { rows: [customer] } = await c.query(
        `INSERT INTO customers (business_id, name, phone, email)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (business_id, phone) WHERE phone IS NOT NULL
         DO UPDATE SET name = EXCLUDED.name, email = COALESCE(EXCLUDED.email, customers.email)
         RETURNING id`,
        [owner.businessId, customerName, customerPhone, customerEmail || null]
      );

      await c.query(
        `INSERT INTO bookings
           (business_id, service_id, staff_id, customer_id, start_time, end_time, status, amount, created_by_staff,
            amount_paid, payment_note)
         VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED', $7, true, $8, $9)`,
        [
          owner.businessId,
          serviceId,
          staffId,
          customer.id,
          startTime.toISOString(),
          endTime.toISOString(),
          amount,
          amountPaid,
          paymentNote || null,
        ]
      );
    });
  } catch (err) {
    if (isSlotConflictError(err) || (err as Error).message === "slot_taken") {
      return { ok: false, error: "That staff member already has something scheduled at this time." };
    }
    if ((err as Error).message === "deposit_too_large") {
      return { ok: false, error: "The deposit must be less than the full price — pick \"Paid in full\" instead." };
    }
    console.error("createManualBooking failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Only these target statuses are reachable from the dashboard, and only
// from these source statuses — never trust a status string from the client
// beyond picking among a fixed, validated set of transitions.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  CANCELLED: ["TEMPORARY_HOLD", "PAYMENT_PENDING", "CONFIRMED"],
  COMPLETED: ["CONFIRMED"],
  NO_SHOW: ["CONFIRMED"],
};

export type StatusChangeResult = { ok: true; message?: string } | { ok: false; error: string };

const STATUS_CHANGE_MESSAGE: Record<string, string> = {
  CANCELLED: "Booking cancelled",
  COMPLETED: "Booking marked complete",
  NO_SHOW: "Booking marked no-show",
};

export async function updateBookingStatus(
  _prev: StatusChangeResult | null,
  formData: FormData
): Promise<StatusChangeResult> {
  const owner = await requireOwner();
  const bookingId = String(formData.get("bookingId") ?? "");
  const nextStatus = String(formData.get("nextStatus") ?? "");

  const allowedFrom = ALLOWED_TRANSITIONS[nextStatus];
  if (!allowedFrom) {
    return { ok: false, error: "Invalid status change." };
  }

  const updated = await withBusinessContext(owner.businessId, async (c) => {
    const { rows: [row] } = await c.query<{
      class_session_id: string | null;
      package_purchase_id: string | null;
      service_id: string;
      start_time: string;
    }>(
      `UPDATE bookings SET status = $1
       WHERE id = $2 AND status = ANY($3::booking_status[])
       RETURNING class_session_id, package_purchase_id, service_id, start_time`,
      [nextStatus, bookingId, allowedFrom]
    );
    // Only an actual cancellation frees the seat / restores the package
    // session — a no-show still took the spot (and used the redemption),
    // they just didn't turn up for it.
    if (row && nextStatus === "CANCELLED") {
      if (row.class_session_id) await releaseClassSeat(c, row.class_session_id);
      if (row.package_purchase_id) await restorePackageSession(c, row.package_purchase_id);
    }
    return row ?? null;
  });

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");

  // Someone else could have already changed this booking's status (another
  // tab, a webhook, a concurrent request) — never claim success unless the
  // update actually matched a row.
  if (!updated) {
    return { ok: false, error: "This booking already changed. Nothing was updated." };
  }
  // The owner cancelling from the dashboard is just as real a cancellation
  // as the customer's own self-service one — fire-and-forget, after commit.
  if (nextStatus === "CANCELLED") {
    void notify("booking_cancelled", bookingId);
    void checkWaitlistForCancelledSlot(owner.businessId, updated.service_id, updated.start_time);
  }
  return { ok: true, message: STATUS_CHANGE_MESSAGE[nextStatus] ?? "Booking updated" };
}

/**
 * Purely informational — a note + "special attention" flag an owner can put
 * on one customer's booking (e.g. a VIP who needs extra care). Never read by
 * booking/payment/availability logic, only rendered back as a highlight on
 * the calendar and in the reminders banner.
 */
export async function updateBookingNote(
  _prev: StatusChangeResult | null,
  formData: FormData
): Promise<StatusChangeResult> {
  const owner = await requireOwner();
  const bookingId = String(formData.get("bookingId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const flagged = formData.get("flagged") === "on";

  await withBusinessContext(owner.businessId, (c) =>
    c.query(`UPDATE bookings SET owner_note = $1, is_flagged = $2 WHERE id = $3`, [
      note || null,
      flagged,
      bookingId,
    ])
  );

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  return { ok: true, message: "Note saved" };
}

/**
 * The customer paid the rest of a staff-created booking in person (see
 * amount_paid in 033_manual_payment_and_class_series.sql). Only ever moves
 * amount_paid up to the booking's own amount — the value comes from the
 * row, never the client — and only for rows that track it at all.
 */
export async function markBookingPaid(
  _prev: StatusChangeResult | null,
  formData: FormData
): Promise<StatusChangeResult> {
  const owner = await requireOwner();
  const bookingId = String(formData.get("bookingId") ?? "");

  const updated = await withBusinessContext(owner.businessId, async (c) => {
    const { rowCount } = await c.query(
      `UPDATE bookings SET amount_paid = amount
       WHERE id = $1 AND amount_paid IS NOT NULL AND amount_paid < amount
         AND status IN ('CONFIRMED', 'COMPLETED', 'NO_SHOW')`,
      [bookingId]
    );
    return (rowCount ?? 0) > 0;
  });

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
  if (!updated) {
    return { ok: false, error: "This booking already changed. Nothing was updated." };
  }
  return { ok: true, message: "Marked as paid" };
}

"use server";

import { withBusinessContext } from "@/db/client";
import { stripe } from "@/lib/stripe";
import { getAvailableSlots, type Slot } from "@/lib/availability";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { claimClassSeat, releaseClassSeat } from "@/lib/classes";
import { getOrCreateAnonId } from "@/lib/anon-session";
import { isStaffFreeForRange } from "@/lib/staff-availability";

// Quick booking lets a visitor reserve a slot before typing anything —
// which also means nothing stops one visitor from holding every remaining
// slot in a day with no contact info attached, making a business look
// fully booked when it isn't. Capped per business per anonymous visitor
// (see lib/anon-session.ts), not globally — legitimately browsing several
// businesses shouldn't count against each other.
const MAX_ACTIVE_HOLDS_PER_VISITOR = 2;

export async function fetchSlots(
  businessId: string,
  serviceId: string,
  dateISO: string
): Promise<Slot[]> {
  return getAvailableSlots(businessId, serviceId, dateISO);
}

export type QuickHoldResult =
  | { ok: true; bookingId: string }
  | { ok: false; reason: "slot_taken" | "too_many_holds" | "server_error" };

/**
 * "Quick booking": reserve the slot the instant it's picked, with no
 * customer info yet — customer_id is nullable on bookings for exactly this.
 * Contact details are collected afterward (completeBookingDetails), on the
 * theory that committing to a slot first and asking questions second loses
 * fewer customers than a long form standing between them and a locked-in
 * time. The hold is still the real guard: the exclusion constraint from
 * spikes/atomic-booking is what actually prevents double-booking, not this
 * two-step UI order.
 */
export async function createQuickHold(input: {
  businessId: string;
  serviceId: string;
  startTime: string;
  endTime: string;
}): Promise<QuickHoldResult> {
  const { businessId, serviceId, startTime, endTime } = input;
  const anonId = await getOrCreateAnonId();

  try {
    const bookingId = await withBusinessContext(businessId, async (c) => {
      const { rows: [{ count }] } = await c.query<{ count: string }>(
        `SELECT count(*) FROM bookings
         WHERE business_id = $1 AND anon_id = $2 AND status IN ('TEMPORARY_HOLD', 'PAYMENT_PENDING')`,
        [businessId, anonId]
      );
      if (Number(count) >= MAX_ACTIVE_HOLDS_PER_VISITOR) throw new Error("too_many_holds");

      const { rows: [service] } = await c.query(
        `SELECT price_amount, payment_mode, deposit_amount FROM services WHERE id = $1`,
        [serviceId]
      );
      if (!service) throw new Error("service_not_found");

      const { rows: [assignment] } = await c.query(
        `SELECT staff_id FROM staff_services WHERE service_id = $1 LIMIT 1`,
        [serviceId]
      );
      if (!assignment) throw new Error("no_staff_assigned");

      // A class session or a block occupies its staff member exclusively
      // too, but (see migration 013's note) those live in separate tables
      // from bookings' own exclusion constraint — see
      // lib/staff-availability.ts for what this can and can't guarantee.
      if (!(await isStaffFreeForRange(c, assignment.staff_id, startTime, endTime))) {
        throw new Error("slot_taken");
      }

      const amount =
        service.payment_mode === "free"
          ? 0
          : service.payment_mode === "deposit"
            ? service.deposit_amount
            : service.price_amount;

      const { rows: [booking] } = await c.query(
        `INSERT INTO bookings
           (business_id, service_id, staff_id, start_time, end_time, status, hold_expires_at, amount, anon_id)
         VALUES ($1, $2, $3, $4, $5, 'TEMPORARY_HOLD', $6, $7, $8)
         RETURNING id`,
        [
          businessId,
          serviceId,
          assignment.staff_id,
          startTime,
          endTime,
          new Date(Date.now() + 10 * 60_000),
          amount,
          anonId,
        ]
      );
      return booking.id;
    });

    return { ok: true, bookingId };
  } catch (err) {
    if ((err as { code?: string }).code === "23P01" || (err as Error).message === "slot_taken") {
      return { ok: false, reason: "slot_taken" };
    }
    if ((err as Error).message === "too_many_holds") {
      return { ok: false, reason: "too_many_holds" };
    }
    console.error("createQuickHold failed", err);
    return { ok: false, reason: "server_error" };
  }
}

export type ReserveSeatResult =
  | { ok: true; bookingId: string }
  | { ok: false; reason: "class_full" | "too_many_holds" | "server_error" };

/**
 * Class-booking equivalent of createQuickHold: claims one seat on an
 * existing class_sessions row (atomically, via claimClassSeat) and creates
 * a normal TEMPORARY_HOLD booking tagged with that session — from here on
 * it flows through the exact same details/payment/confirmation code as a
 * 1:1 booking.
 */
export async function reserveClassSeat(input: {
  businessId: string;
  classSessionId: string;
}): Promise<ReserveSeatResult> {
  const { businessId, classSessionId } = input;
  const anonId = await getOrCreateAnonId();

  try {
    const bookingId = await withBusinessContext(businessId, async (c) => {
      const { rows: [{ count }] } = await c.query<{ count: string }>(
        `SELECT count(*) FROM bookings
         WHERE business_id = $1 AND anon_id = $2 AND status IN ('TEMPORARY_HOLD', 'PAYMENT_PENDING')`,
        [businessId, anonId]
      );
      if (Number(count) >= MAX_ACTIVE_HOLDS_PER_VISITOR) throw new Error("too_many_holds");

      const { rows: [session] } = await c.query(
        `SELECT service_id, staff_id, start_time, end_time FROM class_sessions WHERE id = $1`,
        [classSessionId]
      );
      if (!session) throw new Error("server_error");

      const claimed = await claimClassSeat(c, classSessionId);
      if (!claimed) throw new Error("class_full");

      const { rows: [service] } = await c.query(
        `SELECT price_amount, payment_mode, deposit_amount FROM services WHERE id = $1`,
        [session.service_id]
      );
      const amount =
        service.payment_mode === "free"
          ? 0
          : service.payment_mode === "deposit"
            ? service.deposit_amount
            : service.price_amount;

      const { rows: [booking] } = await c.query(
        `INSERT INTO bookings
           (business_id, service_id, staff_id, start_time, end_time, status, hold_expires_at, amount, class_session_id, anon_id)
         VALUES ($1, $2, $3, $4, $5, 'TEMPORARY_HOLD', $6, $7, $8, $9)
         RETURNING id`,
        [
          businessId,
          session.service_id,
          session.staff_id,
          session.start_time,
          session.end_time,
          new Date(Date.now() + 10 * 60_000),
          amount,
          classSessionId,
          anonId,
        ]
      );
      return booking.id;
    });

    return { ok: true, bookingId };
  } catch (err) {
    if ((err as Error).message === "class_full") {
      return { ok: false, reason: "class_full" };
    }
    if ((err as Error).message === "too_many_holds") {
      return { ok: false, reason: "too_many_holds" };
    }
    console.error("reserveClassSeat failed", err);
    return { ok: false, reason: "server_error" };
  }
}

export type CompleteDetailsResult =
  | { ok: true; bookingId: string; needsPayment: boolean }
  | { ok: false; reason: "invalid_input" | "hold_expired" | "server_error" };

/** Shared by completeBookingDetails — same PromptPay/card branching either way. */
async function initiatePayment(params: {
  businessId: string;
  bookingId: string;
  amount: number;
  stripeAccountId: string;
  paymentMethod: "promptpay" | "card";
  customerName: string;
  customerEmail: string;
  classSessionId: string | null;
}): Promise<{ ok: true } | { ok: false }> {
  const {
    businessId,
    bookingId,
    amount,
    stripeAccountId,
    paymentMethod,
    customerName,
    customerEmail,
    classSessionId,
  } = params;

  try {
    let paymentIntentId: string;

    if (paymentMethod === "card") {
      // No pre-attached PaymentMethod and no confirm:true — cards need the
      // customer to actually enter details (and possibly complete 3D
      // Secure) client-side via Stripe Elements on the payment page, unlike
      // PromptPay which Stripe can confirm immediately server-side into a
      // QR the customer scans.
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount,
          currency: "thb",
          payment_method_types: ["card"],
          metadata: { booking_id: bookingId },
        },
        { stripeAccount: stripeAccountId }
      );
      paymentIntentId = paymentIntent.id;
    } else {
      const stripePaymentMethod = await stripe.paymentMethods.create(
        { type: "promptpay", billing_details: { name: customerName, email: customerEmail } },
        { stripeAccount: stripeAccountId }
      );
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount,
          currency: "thb",
          payment_method_types: ["promptpay"],
          payment_method: stripePaymentMethod.id,
          confirm: true,
          metadata: { booking_id: bookingId },
        },
        { stripeAccount: stripeAccountId }
      );
      paymentIntentId = paymentIntent.id;
    }

    await withBusinessContext(businessId, (c) =>
      c.query(
        `UPDATE bookings SET stripe_payment_intent_id = $1, status = 'PAYMENT_PENDING' WHERE id = $2`,
        [paymentIntentId, bookingId]
      )
    );
    return { ok: true };
  } catch (err) {
    console.error("Stripe payment setup failed", err);
    await withBusinessContext(businessId, async (c) => {
      await c.query(`UPDATE bookings SET status = 'PAYMENT_FAILED' WHERE id = $1`, [bookingId]);
      if (classSessionId) await releaseClassSeat(c, classSessionId);
    });
    return { ok: false };
  }
}

/**
 * Second step of quick booking: attach the customer to an existing
 * TEMPORARY_HOLD and, if the service isn't free, kick off payment.
 * businessId comes from the details page's own slug resolution, not from
 * the client beyond that — never trust a bookingId alone as proof of which
 * business it belongs to.
 */
export async function completeBookingDetails(input: {
  businessId: string;
  bookingId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  paymentMethod: "promptpay" | "card";
  customFieldValues?: { fieldId: string; value: string }[];
}): Promise<CompleteDetailsResult> {
  const {
    businessId,
    bookingId,
    customerName,
    customerPhone,
    customerEmail,
    paymentMethod,
    customFieldValues = [],
  } = input;

  if (!customerName.trim() || !customerPhone.trim() || !customerEmail.trim()) {
    return { ok: false, reason: "invalid_input" };
  }

  type Setup = { amount: number; stripeAccountId: string | null; classSessionId: string | null };
  let setup: Setup;
  try {
    setup = await withBusinessContext(businessId, async (c) => {
      const { rows: [booking] } = await c.query(
        `SELECT status, amount, hold_expires_at, service_id, class_session_id FROM bookings WHERE id = $1`,
        [bookingId]
      );
      if (!booking || booking.status !== "TEMPORARY_HOLD") {
        throw new Error("hold_expired");
      }
      if (booking.hold_expires_at && new Date(booking.hold_expires_at) < new Date()) {
        await c.query(`UPDATE bookings SET status = 'EXPIRED' WHERE id = $1`, [bookingId]);
        if (booking.class_session_id) await releaseClassSeat(c, booking.class_session_id);
        throw new Error("hold_expired");
      }

      // The client only disables submit for required fields it knows
      // about — re-validate against the service's actual fields here too,
      // since this is a public endpoint and the client's copy could be
      // stale or bypassed entirely.
      const { rows: fields } = await c.query<{
        id: string;
        label: string;
        importance: "optional" | "important" | "required";
      }>(`SELECT id, label, importance FROM service_custom_fields WHERE service_id = $1`, [
        booking.service_id,
      ]);
      const valueByFieldId = new Map(customFieldValues.map((v) => [v.fieldId, v.value.trim()]));
      for (const field of fields) {
        if (field.importance === "required" && !valueByFieldId.get(field.id)) {
          throw new Error("invalid_input");
        }
      }

      const { rows: [customer] } = await c.query(
        `INSERT INTO customers (business_id, name, phone, email)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (business_id, phone) WHERE phone IS NOT NULL
         DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email
         RETURNING id`,
        [businessId, customerName.trim(), customerPhone.trim(), customerEmail.trim()]
      );

      const finalStatus = booking.amount > 0 ? "TEMPORARY_HOLD" : "CONFIRMED";
      await c.query(`UPDATE bookings SET customer_id = $1, status = $2 WHERE id = $3`, [
        customer.id,
        finalStatus,
        bookingId,
      ]);

      for (const field of fields) {
        const value = valueByFieldId.get(field.id);
        if (!value) continue;
        await c.query(
          `INSERT INTO booking_field_responses (business_id, booking_id, field_id, label, importance, value)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [businessId, bookingId, field.id, field.label, field.importance, value]
        );
      }

      const { rows: [business] } = await c.query(
        `SELECT stripe_account_id FROM businesses WHERE id = $1`,
        [businessId]
      );

      return {
        amount: booking.amount,
        stripeAccountId: business.stripe_account_id,
        classSessionId: booking.class_session_id,
      };
    });
  } catch (err) {
    if ((err as Error).message === "invalid_input") {
      return { ok: false, reason: "invalid_input" };
    }
    if ((err as Error).message === "hold_expired") {
      return { ok: false, reason: "hold_expired" };
    }
    console.error("completeBookingDetails failed", err);
    return { ok: false, reason: "server_error" };
  }

  if (setup.amount === 0) {
    await sendBookingConfirmationEmail(bookingId);
    return { ok: true, bookingId, needsPayment: false };
  }

  if (!setup.stripeAccountId) {
    console.error("Business has no stripe_account_id — cannot take payment", businessId);
    return { ok: false, reason: "server_error" };
  }

  const paymentResult = await initiatePayment({
    businessId,
    bookingId,
    amount: setup.amount,
    stripeAccountId: setup.stripeAccountId,
    paymentMethod,
    customerName: customerName.trim(),
    customerEmail: customerEmail.trim(),
    classSessionId: setup.classSessionId,
  });

  if (!paymentResult.ok) {
    return { ok: false, reason: "server_error" };
  }

  return { ok: true, bookingId, needsPayment: true };
}

"use server";

import { withBusinessContext } from "@/db/client";
import { stripe } from "@/lib/stripe";
import { getAvailableSlots, type Slot } from "@/lib/availability";

export async function fetchSlots(
  businessId: string,
  serviceId: string,
  dateISO: string
): Promise<Slot[]> {
  return getAvailableSlots(businessId, serviceId, dateISO);
}

export type QuickHoldResult =
  | { ok: true; bookingId: string }
  | { ok: false; reason: "slot_taken" | "server_error" };

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

  try {
    const bookingId = await withBusinessContext(businessId, async (c) => {
      // Sweep this business's own abandoned holds before inserting — the
      // EXCLUDE constraint only checks `status`, not hold_expires_at, so an
      // old TEMPORARY_HOLD nobody ever came back to would otherwise block
      // this slot forever. Cheap: indexed on business_id, and only matters
      // right when a new insert is about to contend for the same row.
      await c.query(
        `UPDATE bookings SET status = 'EXPIRED'
         WHERE status IN ('TEMPORARY_HOLD', 'PAYMENT_PENDING') AND hold_expires_at < now()`
      );

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

      const amount =
        service.payment_mode === "free"
          ? 0
          : service.payment_mode === "deposit"
            ? service.deposit_amount
            : service.price_amount;

      const { rows: [booking] } = await c.query(
        `INSERT INTO bookings
           (business_id, service_id, staff_id, start_time, end_time, status, hold_expires_at, amount)
         VALUES ($1, $2, $3, $4, $5, 'TEMPORARY_HOLD', $6, $7)
         RETURNING id`,
        [businessId, serviceId, assignment.staff_id, startTime, endTime, new Date(Date.now() + 10 * 60_000), amount]
      );
      return booking.id;
    });

    return { ok: true, bookingId };
  } catch (err) {
    if ((err as { code?: string }).code === "23P01") {
      return { ok: false, reason: "slot_taken" };
    }
    console.error("createQuickHold failed", err);
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
}): Promise<{ ok: true } | { ok: false }> {
  const { businessId, bookingId, amount, stripeAccountId, paymentMethod, customerName, customerEmail } =
    params;

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
    await withBusinessContext(businessId, (c) =>
      c.query(`UPDATE bookings SET status = 'PAYMENT_FAILED' WHERE id = $1`, [bookingId])
    );
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
}): Promise<CompleteDetailsResult> {
  const { businessId, bookingId, customerName, customerPhone, customerEmail, paymentMethod } = input;

  if (!customerName.trim() || !customerPhone.trim() || !customerEmail.trim()) {
    return { ok: false, reason: "invalid_input" };
  }

  type Setup = { amount: number; stripeAccountId: string | null };
  let setup: Setup;
  try {
    setup = await withBusinessContext(businessId, async (c) => {
      const { rows: [booking] } = await c.query(
        `SELECT status, amount, hold_expires_at FROM bookings WHERE id = $1`,
        [bookingId]
      );
      if (!booking || booking.status !== "TEMPORARY_HOLD") {
        throw new Error("hold_expired");
      }
      if (booking.hold_expires_at && new Date(booking.hold_expires_at) < new Date()) {
        await c.query(`UPDATE bookings SET status = 'EXPIRED' WHERE id = $1`, [bookingId]);
        throw new Error("hold_expired");
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

      const { rows: [business] } = await c.query(
        `SELECT stripe_account_id FROM businesses WHERE id = $1`,
        [businessId]
      );

      return { amount: booking.amount, stripeAccountId: business.stripe_account_id };
    });
  } catch (err) {
    if ((err as Error).message === "hold_expired") {
      return { ok: false, reason: "hold_expired" };
    }
    console.error("completeBookingDetails failed", err);
    return { ok: false, reason: "server_error" };
  }

  if (setup.amount === 0) {
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
  });

  if (!paymentResult.ok) {
    return { ok: false, reason: "server_error" };
  }

  return { ok: true, bookingId, needsPayment: true };
}

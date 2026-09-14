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

export type CreateHoldResult =
  | { ok: true; bookingId: string; needsPayment: boolean }
  | { ok: false; reason: "slot_taken" | "invalid_input" | "server_error" };

export async function createHold(input: {
  businessId: string;
  serviceId: string;
  startTime: string;
  endTime: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  paymentMethod: "promptpay" | "card";
}): Promise<CreateHoldResult> {
  const {
    businessId,
    serviceId,
    startTime,
    endTime,
    customerName,
    customerPhone,
    customerEmail,
    paymentMethod,
  } = input;

  if (!customerName.trim() || !customerPhone.trim() || !customerEmail.trim()) {
    return { ok: false, reason: "invalid_input" };
  }

  type HoldSetup = {
    bookingId: string;
    amount: number;
    stripeAccountId: string | null;
  };

  let setup: HoldSetup;
  try {
    setup = await withBusinessContext(businessId, async (c) => {
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

      const { rows: [customer] } = await c.query(
        `INSERT INTO customers (business_id, name, phone, email)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (business_id, phone) WHERE phone IS NOT NULL
         DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email
         RETURNING id`,
        [businessId, customerName.trim(), customerPhone.trim(), customerEmail.trim()]
      );

      const initialStatus = amount > 0 ? "TEMPORARY_HOLD" : "CONFIRMED";
      const holdExpiresAt = amount > 0 ? new Date(Date.now() + 10 * 60_000) : null;

      const { rows: [booking] } = await c.query(
        `INSERT INTO bookings
           (business_id, service_id, staff_id, customer_id, start_time, end_time, status, hold_expires_at, amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          businessId,
          serviceId,
          assignment.staff_id,
          customer.id,
          startTime,
          endTime,
          initialStatus,
          holdExpiresAt,
          amount,
        ]
      );

      const { rows: [business] } = await c.query(
        `SELECT stripe_account_id FROM businesses WHERE id = $1`,
        [businessId]
      );

      return {
        bookingId: booking.id,
        amount,
        stripeAccountId: business.stripe_account_id,
      };
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23P01") {
      return { ok: false, reason: "slot_taken" };
    }
    console.error("createHold failed", err);
    return { ok: false, reason: "server_error" };
  }

  if (setup.amount === 0) {
    return { ok: true, bookingId: setup.bookingId, needsPayment: false };
  }

  if (!setup.stripeAccountId) {
    console.error("Business has no stripe_account_id — cannot take payment", businessId);
    return { ok: false, reason: "server_error" };
  }

  try {
    let paymentIntentId: string;

    if (paymentMethod === "card") {
      // No pre-attached PaymentMethod and no confirm:true here — cards need
      // the customer to actually enter details (and possibly complete 3D
      // Secure) client-side via Stripe Elements on the payment page, unlike
      // PromptPay which Stripe can confirm immediately server-side into a
      // QR the customer scans.
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: setup.amount,
          currency: "thb",
          payment_method_types: ["card"],
          metadata: { booking_id: setup.bookingId },
        },
        { stripeAccount: setup.stripeAccountId }
      );
      paymentIntentId = paymentIntent.id;
    } else {
      const stripePaymentMethod = await stripe.paymentMethods.create(
        {
          type: "promptpay",
          billing_details: { name: customerName.trim(), email: customerEmail.trim() },
        },
        { stripeAccount: setup.stripeAccountId }
      );

      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: setup.amount,
          currency: "thb",
          payment_method_types: ["promptpay"],
          payment_method: stripePaymentMethod.id,
          confirm: true,
          metadata: { booking_id: setup.bookingId },
        },
        { stripeAccount: setup.stripeAccountId }
      );
      paymentIntentId = paymentIntent.id;
    }

    await withBusinessContext(businessId, (c) =>
      c.query(
        `UPDATE bookings SET stripe_payment_intent_id = $1, status = 'PAYMENT_PENDING' WHERE id = $2`,
        [paymentIntentId, setup.bookingId]
      )
    );
  } catch (err) {
    console.error("Stripe payment setup failed", err);
    await withBusinessContext(businessId, (c) =>
      c.query(`UPDATE bookings SET status = 'PAYMENT_FAILED' WHERE id = $1`, [setup.bookingId])
    );
    return { ok: false, reason: "server_error" };
  }

  return { ok: true, bookingId: setup.bookingId, needsPayment: true };
}

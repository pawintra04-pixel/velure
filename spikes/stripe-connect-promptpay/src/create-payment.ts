import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
const accountId = process.env.MERCHANT_ACCOUNT_ID; // acct_... from create-merchant.ts
if (!secretKey || !accountId) {
  console.error("Set STRIPE_SECRET_KEY and MERCHANT_ACCOUNT_ID (from create-merchant.ts).");
  process.exit(1);
}

const stripe = new Stripe(secretKey);

async function main() {
  // Direct charge on the connected account (via the stripeAccount request option) —
  // NOT a destination charge through the platform. This is what "เงินเข้าร้านโดยตรง
  // ไม่ผ่านบัญชีกลาง" (money goes straight to the shop, not through a central account)
  // in docs/ARCHITECTURE.md actually means: the PaymentIntent and the resulting
  // funds live on the merchant's own connected account from the start.
  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: 10000, // ฿100.00 — Stripe amounts are in satang for THB
      currency: "thb",
      payment_method_types: ["promptpay"],
      payment_method: (
        await stripe.paymentMethods.create(
          {
            type: "promptpay",
            billing_details: {
              email: "customer@example.com",
              name: "Test Customer",
            },
          },
          { stripeAccount: accountId }
        )
      ).id,
      confirm: true,
    },
    { stripeAccount: accountId }
  );

  console.log("PaymentIntent created:", paymentIntent.id);
  console.log("Status:", paymentIntent.status);

  const qrAction = paymentIntent.next_action?.promptpay_display_qr_code;
  if (qrAction) {
    console.log("\nPromptPay QR image (data URL):", qrAction.image_url_png?.slice(0, 60), "...");
    console.log("Hosted instructions URL (open this to pay/simulate in test mode):");
    console.log(qrAction.hosted_instructions_url);
  } else {
    console.log("No PromptPay next_action returned — check paymentIntent.next_action:", paymentIntent.next_action);
  }

  // Register the hold with our local "booking" server so the webhook handler
  // has something to transition to CONFIRMED when payment succeeds.
  await fetch("http://localhost:4242/create-booking-hold", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
  });

  console.log("\nBooking hold registered. Now pay via the hosted instructions URL above,");
  console.log(`then check status: curl http://localhost:4242/booking/${paymentIntent.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

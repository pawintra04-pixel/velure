import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error("Set STRIPE_SECRET_KEY (a test key, starts with sk_test_) and re-run.");
  process.exit(1);
}
if (!secretKey.startsWith("sk_test_")) {
  console.error("Refusing to run against a non-test key. This spike must run in Stripe test mode.");
  process.exit(1);
}

const stripe = new Stripe(secretKey);

async function main() {
  // Standard, not Express/Custom: Stripe rejects Express/Custom accounts for
  // TH-based platforms ("Platforms in TH cannot create accounts where the
  // platform is loss-liable, due to risk control measures") — discovered live
  // while running this spike. Standard accounts are fully liable for
  // themselves, which is also the better fit for "เงินเข้าร้านโดยตรง ไม่ผ่าน
  // บัญชีกลาง" anyway: the merchant owns their own Stripe identity outright.
  const account = await stripe.accounts.create({
    type: "standard",
    country: "TH",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
      promptpay_payments: { requested: true },
    },
  });

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: "https://example.com/reauth",
    return_url: "https://example.com/done",
    type: "account_onboarding",
  });

  console.log("Connected account created:", account.id);
  console.log("\nOpen this URL to complete onboarding (test mode — use Stripe's test-mode 'skip' fill-ins):");
  console.log(accountLink.url);
  console.log("\nSave the account id above — the payment spike (create-payment.ts) needs it.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

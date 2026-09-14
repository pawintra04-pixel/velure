# Spike: Stripe Connect + PromptPay — setup notes

Covers Phase 0 spikes 1 (Stripe Connect + PromptPay) and 3 (webhook
reliability) together, since both need the same merchant account and
webhook plumbing.

## What you need to provide

1. A Stripe account (free, no business verification needed for test mode —
   just email signup at https://dashboard.stripe.com/register).
2. In the dashboard, **test mode** (toggle top-right), then
   Settings → Connect → make sure Connect is enabled for your account.
3. Your test secret key from https://dashboard.stripe.com/test/apikeys
   (starts with `sk_test_`).

Give me the `sk_test_...` key (or set it yourself as an env var — see
below) and I'll continue.

## How this spike runs (once the key is available)

The Stripe CLI is already downloaded locally at `./bin/stripe` — no brew/
Docker needed.

```bash
export STRIPE_SECRET_KEY=sk_test_...

# 1. Create the merchant's Connect account + onboarding link
npm run merchant
# Opens/prints a URL — complete the hosted onboarding (test mode has
# "skip this step" fill-ins for every field). Save the printed acct_... id.

export MERCHANT_ACCOUNT_ID=acct_...

# 2. Forward Stripe webhook events (including Connect events, since this
#    spike uses direct charges on the connected account) to our local server
./bin/stripe listen --forward-to localhost:4242/webhook --forward-connect-to localhost:4242/webhook
# Prints a webhook signing secret (whsec_...) — copy it.

export STRIPE_WEBHOOK_SECRET=whsec_...

# 3. In another terminal: start the booking/webhook receiver
npm run server

# 4. In another terminal: create the ฿100 PromptPay payment
npm run pay
# Prints a hosted_instructions_url — open it in a browser. Test mode shows
# a "simulate successful payment" affordance instead of a real bank app.

# 5. Confirm the booking flipped to CONFIRMED
curl http://localhost:4242/booking/<payment_intent_id>

# 6. Prove webhook idempotency (spike 3) — replay the exact same signed
#    event Stripe already delivered and confirm it's a no-op the 2nd time
npm run replay
```

## What "pass" looks like

- `npm run pay` → PromptPay QR/hosted page appears, tied to the merchant's
  own connected account (not the platform account).
- After paying (or simulating payment) in test mode, the webhook fires,
  `npm run server`'s log shows `-> CONFIRMED (confirm side-effect run #1)`.
- `npm run replay` shows the server logging `DUPLICATE event ... skipping
  side effect` and the confirm counter does NOT advance to #2.
- Stripe test-mode dashboard shows the payment landed on the connected
  account's balance, not the platform's.

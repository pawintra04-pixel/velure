# Spike: Stripe Connect + PromptPay, and webhook reliability — RESULT

**Status: PASS (both spikes)**

## What was tested

End-to-end, against real Stripe test-mode infrastructure (not mocked):

1. Create a merchant Connect account.
2. Create a ฿100 PromptPay payment as a **direct charge** on that account.
3. Pay it (simulated) → webhook fires → booking flips to `CONFIRMED`.
4. Replay the exact same signed webhook Stripe already delivered → confirm
   it's treated as a no-op, not a second confirmation.

## Result

- PaymentIntent `pi_3UFRvRECGTB3Jt921d1iK0xU` created directly on the
  merchant's own connected account, ฿100.00 THB, PromptPay.
- Payment simulated successful via Stripe's test-mode "Simulate scan" →
  "Payment successful" flow.
- `server.ts` log: `-> CONFIRMED (confirm side-effect run #1)`.
- `npm run replay` (resending the identical signed webhook body): server
  responded `{ received: true, duplicate: true }`; booking stayed at
  `confirmedCount: 1`. No double-confirmation.

## Real findings from this run (not just "it worked")

These surfaced only because this was run against live Stripe test infra,
not a mock — exactly the point of a Phase 0 spike.

1. **Thailand platforms cannot use Express/Custom connected accounts.**
   Stripe error: *"Platforms in TH cannot create accounts where the
   platform is loss-liable, due to risk control measures."* Only
   **Standard** accounts are allowed for TH-based platforms. This is a
   real constraint on Velure's architecture, not a spike-only detail —
   `src/create-merchant.ts` uses `type: "standard"`. Standard accounts
   also happen to fit the "เงินเข้าร้านโดยตรง ไม่ผ่านบัญชีกลาง" positioning
   better anyway: the merchant is fully liable for (i.e., fully owns) their
   own account, not the platform.

2. **New Stripe accounts default to requiring Accounts v2**, and reject v1
   account creation calls (`stripe.accounts.create`) out of the box. We
   enabled the "Accounts v1 support" compatibility toggle in
   Settings → Account features to keep using the well-documented v1 API for
   this spike. **Before scaffolding the real app**, decide deliberately
   whether to build on v1 (compat toggle, more tutorials/docs available) or
   v2 (`/v2/core/accounts`, what Stripe now steers new integrations toward)
   — this wasn't a decision made yet, just a toggle flipped to unblock the
   spike.

3. **Thai onboarding KYC fields validate real checksums.** The "Personal
   Identification Number" field enforces the actual Thai national ID
   check-digit algorithm even in test mode — a random 13-digit number is
   rejected. A synthetically-generated number that satisfies the checksum
   (not a real person's ID) was needed to get through onboarding.

4. **`billing_details.email` is required** when creating a `promptpay`
   PaymentMethod — not obvious from a bare `type: "promptpay"` call.

## Carry into the real schema/integration

- Connected accounts: `type: "standard"`, decide v1-vs-v2 Accounts API
  deliberately (see finding 2) before writing the real Business Setup
  engine's Stripe onboarding flow.
- Webhook idempotency: key on Stripe's `event.id`, not `payment_intent.id`
  — a single payment can generate multiple event types
  (`charge.updated` came through on replay here, not just
  `payment_intent.succeeded`), so id-based dedup must not assume event type.
- Direct charges on connected accounts deliver webhooks as **Connect
  events** — the real webhook endpoint needs `--forward-connect-to`
  equivalent behavior (i.e., subscribe to Connect webhook events, not only
  the platform's own account events).

## Run it yourself

See `NOTES.md` for the full step-by-step (needs a Stripe test secret key
in `.env`, which is gitignored).

# Velure — web app

Next.js 16 (App Router) + Postgres. This is the real product, built after
all 4 Phase 0 proof spikes (`../spikes/`) passed.

**Note**: This Next.js version has real breaking changes from older
versions — see `AGENTS.md` / `node_modules/next/dist/docs/` before writing
app code that assumes older conventions.

**Language**: UI is English throughout (product decision — see git log).
Demo data (staff/service/customer names) is English too, for consistency.

## Local setup

No Docker/Homebrew needed — Postgres runs via the `embedded-postgres` npm
package, persisted to `.pgdata/` (gitignored) so data survives restarts.

```bash
npm install

# Terminal 1 — starts Postgres on localhost:54320, stays running
npm run db:start

# Terminal 2 — one-time setup
npm run db:migrate
npm run db:seed        # creates a demo business + ~40 demo bookings
npm run db:smoke-test  # verifies RLS + booking-overlap constraints work

npm run dev             # http://localhost:3000 (or next free port) -> /dashboard
```

### To test the booking + payment flow locally

Needs a Stripe test secret key and webhook forwarding, same as
`../spikes/stripe-connect-promptpay`:

```bash
# .env.local needs: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

# Forward webhooks (reuses the CLI binary downloaded for the spike)
../spikes/stripe-connect-promptpay/bin/stripe listen \
  --api-key "$STRIPE_SECRET_KEY" \
  --forward-to localhost:3001/api/stripe/webhook \
  --forward-connect-to localhost:3001/api/stripe/webhook
# Copy the printed whsec_... into .env.local as STRIPE_WEBHOOK_SECRET,
# then restart `npm run dev` (env vars only load at server start).
```

The seeded demo business is attached to a real Stripe TEST-mode Standard
connected account (created once by hand via the spike's onboarding flow —
see `DEMO_STRIPE_ACCOUNT_ID` in `src/db/seed.ts`). Visit `/book`, pick a
slot, fill in the form, and complete the PromptPay test payment the same
way as the spike (Simulate scan → Authorize test payment).

## Database

- `src/db/migrations/*.sql` — applied in filename order, tracked in
  `schema_migrations`. See each file's comments for the reasoning; several
  directly carry over patterns proven in `../spikes/`:
  - `002_app_role_and_helpers.sql` / `007_row_level_security.sql`:
    tenant isolation via Postgres RLS, same pattern as
    `../spikes/tenant-isolation`.
  - `006_bookings.sql`: double-booking prevention, upgraded from the
    spike's exact-timestamp unique index to a `tstzrange` overlap
    EXCLUDE constraint (real services have duration + buffer, so two
    bookings can collide without sharing an identical start time).
  - `008_stripe_events.sql`: webhook idempotency ledger, keyed on Stripe's
    `event.id` (not `payment_intent_id` — one payment fires multiple event
    types at the same endpoint), same lesson as the Stripe spike.
- `src/db/client.ts` — `appPool` (the non-superuser `app_user` role RLS
  actually applies to) and `withBusinessContext(businessId, fn)`, which
  every business-scoped query should go through. `adminPool` bypasses RLS
  entirely — only for migrations/seeding, and for the few public
  unguessable-id lookups (payment page, booking-status API, the Stripe
  webhook) that have no business context yet by construction.
- `src/db/smoke-test.ts` — re-run after any schema change touching RLS or
  the booking table's constraints. Its cleanup runs in a `finally` block on
  purpose: an earlier version let a mid-run failure skip cleanup and leave
  a stray business row behind, which silently broke the dashboard (it was
  picked up as "the oldest business" by the temporary demo-business stub).

## App structure

- `src/app/dashboard/` — the owner dashboard (today's bookings, month
  revenue, upcoming appointments, a monthly revenue chart).
- `src/app/book/` — the customer-facing booking flow: choose a service →
  pick a date/time → enter contact details → hold the slot → pay via
  PromptPay (or skip straight to confirmed for free services) →
  `src/app/api/stripe/webhook` confirms it. `/` redirects to `/dashboard`.
  This is the actual MVP core loop from docs/ARCHITECTURE.md, integrated
  for real (not just proven standalone like the spike).
- `src/lib/availability.ts` — computes open slots for a service/date.
  **STUB**: business hours are hardcoded (09:00–19:00 Asia/Bangkok) since
  no working-hours data model exists yet (Business Setup engine, not
  built). The slot list is a UI convenience only — the database's overlap
  EXCLUDE constraint is what actually prevents double-booking, so a stale
  slot losing a race just surfaces as "that time was just taken."
- `src/lib/demo-business.ts` — **temporary stub**: resolves to the seeded
  "Velure Demo Spa" business by name. Replace with the authenticated
  owner's business id once real auth exists — every page currently reads
  this instead of a session.
- `src/lib/dashboard-data.ts` — all dashboard queries, via
  `withBusinessContext` (real RLS). `src/lib/money.ts` holds pure
  formatting helpers with no DB import, kept separate so client components
  (like the chart) don't accidentally pull the `pg` driver into the browser
  bundle — that exact mistake shipped once already (Node builtins like
  `tls` don't exist in the browser).
- `src/lib/stripe.ts` — the Stripe client, hard-refuses to run against a
  non-`sk_test_` key.

## What exists vs. doesn't yet

Done: full MVP data model, RLS, booking-overlap prevention, an owner
dashboard on real data, and the full booking → hold → PromptPay payment →
webhook → confirmed loop working end to end in the real app (not a spike).

Not started: any other dashboard pages (bookings list, services, staff,
customers management UI), AI onboarding, embed widget, notifications, real
auth (everything currently reads the one seeded demo business), card
payments (only PromptPay is wired up), reschedule/cancel, refunds.

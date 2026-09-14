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
npm run db:seed        # creates a demo business + owner + ~40 demo bookings
npm run db:smoke-test  # verifies RLS + booking-overlap constraints work

npm run dev             # http://localhost:3000 (or next free port)
```

Sign in with the seeded demo account (printed by `db:seed`, also here):
`demo@velure.app` / `password123`. Its public booking page is
`/book/velure-demo-spa`. Or just sign up for a brand new business at
`/signup` — a booking page and dashboard are created for it immediately,
fully isolated from every other business via RLS.

### To test the booking + payment flow locally

Needs a Stripe test secret key and webhook forwarding, same as
`../spikes/stripe-connect-promptpay`:

```bash
# .env.local needs: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

# Forward webhooks (reuses the CLI binary downloaded for the spike) —
# port must match whatever `npm run dev` actually bound (it prints this;
# falls back past 3000 if something else is already using it)
../spikes/stripe-connect-promptpay/bin/stripe listen \
  --api-key "$STRIPE_SECRET_KEY" \
  --forward-to localhost:3000/api/stripe/webhook \
  --forward-connect-to localhost:3000/api/stripe/webhook
# Copy the printed whsec_... into .env.local as STRIPE_WEBHOOK_SECRET,
# then restart `npm run dev` (env vars only load at server start).
```

The seeded demo business is attached to a real Stripe TEST-mode Standard
connected account (created once by hand via the spike's onboarding flow —
see `DEMO_STRIPE_ACCOUNT_ID` in `src/db/seed.ts`). A newly signed-up
business has no `stripe_account_id` yet — there's no UI to connect one
(that's Business Setup, not built), so its booking flow will fail at the
payment step until one is attached by hand, same as the demo was.

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
  - `009_auth.sql`: adds `businesses.slug` (public booking-page id) and
    `owners`/`sessions` tables for real per-business login. One owner per
    business for MVP — no staff logins yet.
- `src/db/client.ts` — `appPool` (the non-superuser `app_user` role RLS
  actually applies to) and `withBusinessContext(businessId, fn)`, which
  every business-scoped query should go through. `adminPool` bypasses RLS
  entirely — only for migrations/seeding, auth (looking someone up by
  email/session token necessarily precedes knowing their business), and
  the few public unguessable-id lookups (payment page, booking-status API,
  the Stripe webhook) that have no business context yet by construction.
- `src/db/smoke-test.ts` — re-run after any schema change touching RLS or
  the booking table's constraints. Its cleanup runs in a `finally` block on
  purpose: an earlier version let a mid-run failure skip cleanup and leave
  a stray business row behind, which silently broke the dashboard back
  when it read "the oldest business" rather than a real session.

## App structure

- `src/app/dashboard/` — the owner dashboard (today's bookings, month
  revenue, upcoming appointments, a monthly revenue chart). Gated by
  `requireOwner()` — redirects to `/login` if not signed in.
- `src/app/login/`, `src/app/signup/` — real auth. Password hashing via
  Node's built-in `scrypt` (`src/lib/auth.ts`), no external dependency.
  Sessions are opaque tokens in an httpOnly cookie, looked up against the
  `sessions` table (not JWTs — revocable by deleting the row, which
  `logOut` does).
- `src/app/book/[slug]/` — the customer-facing booking flow, reached by a
  business's public slug (e.g. `/book/velure-demo-spa`): choose a service →
  pick a date/time → enter contact details → hold the slot → pay via
  PromptPay (or skip straight to confirmed for free services) →
  `src/app/api/stripe/webhook` confirms it. This is the actual MVP core
  loop from docs/ARCHITECTURE.md, integrated for real (not just proven
  standalone like the spike). `/book/pay/[bookingId]` and
  `/book/confirmed/[bookingId]` stay unscoped by slug — they're reached by
  an unguessable booking id, not by business.
- `src/lib/availability.ts` — computes open slots for a service/date.
  **STUB**: business hours are hardcoded (09:00–19:00 Asia/Bangkok) since
  no working-hours data model exists yet (Business Setup engine, not
  built). The slot list is a UI convenience only — the database's overlap
  EXCLUDE constraint is what actually prevents double-booking, so a stale
  slot losing a race just surfaces as "that time was just taken."
- `src/lib/business.ts` — resolves a public booking slug to a business id
  (via `adminPool`, same category of exception as auth — see above).
- `src/lib/dashboard-data.ts` — all dashboard queries, via
  `withBusinessContext` (real RLS). `src/lib/money.ts` holds pure
  formatting helpers with no DB import, kept separate so client components
  (like the chart) don't accidentally pull the `pg` driver into the browser
  bundle — that exact mistake shipped once already (Node builtins like
  `tls` don't exist in the browser).
- `src/lib/stripe.ts` — the Stripe client, hard-refuses to run against a
  non-`sk_test_` key.

## What exists vs. doesn't yet

Done: full MVP data model, RLS, booking-overlap prevention, real
per-business auth (signup creates an isolated business + owner + public
booking slug immediately — verified live with two separate accounts, zero
data bleed between them), an owner dashboard on real data, and the full
booking → hold → PromptPay payment → webhook → confirmed loop working end
to end in the real app.

Not started: any dashboard management UI (bookings list, services, staff,
customers CRUD — currently only `db/seed.ts` can create these), AI
onboarding, embed widget, notifications, card payments (only PromptPay is
wired up), reschedule/cancel, refunds, connecting a Stripe account for a
newly signed-up business (no UI for it yet).

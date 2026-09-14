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

**Viewing from another device on the same network** (not the machine
running `npm run dev`): `localhost` won't resolve to anything — use the
"Network" URL `next dev` prints instead (e.g. `http://192.168.1.109:3000`).
`next.config.ts`'s `allowedDevOrigins` has to list that IP or Turbopack
blocks the dev/HMR requests from it.

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

Card payments also need `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `.env.local`
(the `pk_test_...` key — safe to be public, it's meant for the browser).
Card checkout uses Stripe Elements (`CardPaymentForm.tsx`) rather than the
server-confirmed flow PromptPay uses, since a card needs the customer to
actually enter details (and possibly complete 3D Secure) client-side.

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
- `src/app/dashboard/services/`, `.../staff/` — add/delete services and
  team members (staff can be assigned which services they perform).
  Deleting one with existing bookings is blocked (FK violation caught and
  turned into a readable error via `src/app/dashboard/error.tsx`) rather
  than cascading the delete — booking history shouldn't silently vanish.
- `src/app/dashboard/bookings/` — List / Day / Week / Month views (`?view=`
  + `?date=` in the URL, so every view is linkable). All four read through
  `src/lib/bookings-data.ts`'s shared `getBookingsInRange`; Month/Week fetch
  exactly the date range their own grid renders (a mismatch here would
  silently blank out real bookings on adjacent-month days). Status actions
  (Complete/No-show/Cancel) validate the transition server-side against a
  fixed allow-list (`ALLOWED_TRANSITIONS` in `bookings/actions.ts`) — never
  trust a status string from the client beyond picking among those.
- `src/app/dashboard/reports/` — overview + by-staff + by-service
  breakdowns, date-range filter (week/month/year/all), CSV export
  (`src/app/api/reports/export`) and a print view (`print:hidden` on chrome,
  `window.print()`). `src/lib/reports-data.ts`'s `resolveReportRange`
  deliberately spans each period's FULL range (including days after
  "today"), matching the dashboard's own month-revenue calculation — a
  confirmed future booking later this month is already-collected revenue,
  not something to hide until its date arrives (this was a real bug caught
  by comparing the two: first version cut "this month" off at today+1).

## Design system

Dashboard uses a dark left sidebar (`src/components/dashboard/Sidebar.tsx`)
rather than a top nav bar — a deliberate choice made after early feedback
that a black-pill-on-white top nav read too close to a well-known
competitor's exact look. Page background is white; stat cards carry a
restrained pastel tint per metric (`StatCard`'s `tone` prop, tokens in
`globals.css`: `--tint-{green,amber,blue,pink}-{bg,ink}`), and the booking
status donut (`BookingStatusDonut.tsx`) uses the reserved status colors
(good/warning/critical), not the tint palette, since it encodes state.

## What exists vs. doesn't yet

Done: full MVP data model, RLS, booking-overlap prevention, real
per-business auth (signup creates an isolated business + owner + public
booking slug immediately — verified live with two separate accounts, zero
data bleed between them), an owner dashboard on real data (incl. a booking
status donut), the full booking → hold → payment (PromptPay **or** card) →
webhook → confirmed loop working end to end in the real app, and
owner-side management: services, staff, a full calendar (list/day/week/
month) with status actions, and reports with CSV export + print.

Not started: customers CRUD UI (only `db/seed.ts` can create these), AI
onboarding, embed widget, notifications, reschedule (cancel/complete/
no-show exist, not reschedule), refunds, connecting a Stripe account for a
newly signed-up business (no UI for it yet), staff-hours/working-hours
management (still the hardcoded 09:00–19:00 stub in `availability.ts`), a
"reserve now, fill in details after" quick-booking flow (explicitly
requested, not yet built — current flow collects contact details before
creating the hold).

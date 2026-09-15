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
  - `010_cancellation_policy.sql`: adds `reschedule_cutoff_hours` (default
    12) and `cancel_cutoff_hours` (default 24) to `businesses` — per-business
    policy, not hardcoded, even though there's no settings UI yet to change
    them from the defaults.
  - `011_service_customization.sql`: adds `services.description`/`image_url`
    plus `service_custom_fields` and `booking_field_responses` (both RLS'd
    the same way as every other tenant table, added inline here since
    `007_row_level_security.sql` already ran).
  - `012_business_settings.sql`: business profile fields (`business_type`,
    `logo_url`, `description`, `address`, `contact_phone`, `contact_email`)
    plus `business_hours` and `staff_hours` — real per-weekday operating
    hours and per-staff schedules (with an optional break window) replacing
    `availability.ts`'s old hardcoded 09:00-19:00-for-everyone stub.
    Backfills every existing business/staff member with those same hours
    so nothing changes until an owner visits Settings; `signup` and
    `addStaff` insert default rows for new ones (a new staff member
    inherits the business's current hours rather than the stub, so
    narrowing shop hours in Settings doesn't get silently overridden by
    the next hire).
  - `013_class_sessions.sql`: multi-seat "class" bookings, layered on top
    of the existing model rather than replacing it. `services.capacity`
    (NULL/1 = ordinary 1:1 service, >1 = a class) plus `class_sessions`
    (one scheduled occurrence — staff, time, capacity, a `seats_booked`
    counter). Each attendee is still an ordinary row in `bookings`, tagged
    with `class_session_id`, reusing its entire existing customer/status/
    payment/cancellation machinery unchanged. The one real schema change:
    `no_overlapping_staff_bookings` now excludes `class_session_id IS NULL`
    rows only, since multiple attendees of the *same* session legitimately
    share an identical (staff, time range) that the old constraint would
    have treated as a collision — see the migration's comment for the one
    resulting gap (a 1:1 hold racing a brand-new class session is checked
    at the application level, not atomically, unlike every other overlap
    in this schema).
  - `014_sweep_trigger_and_rate_limit.sql`: hardening after an external
    architecture review. (a) Moves "sweep expired holds before they can
    block a slot" from something every write path had to remember to call
    in TypeScript (`sweepExpiredHolds`, now deleted) into a `BEFORE INSERT`
    trigger on `bookings` — can't be forgotten by a future write path
    (manual booking by staff, an import) the way a function call could be.
    A partial-index predicate can't reference `now()`, so the exclusion
    constraint itself can never encode "expired" directly — a trigger is
    the correct place for this, not a workaround. Scoped to `NEW.staff_id`
    and INSERT-only (the UPDATE/reschedule path already surfaces a stale
    collision as an ordinary "that time was just taken" via the
    constraint, so it doesn't need this, and running it on UPDATE risked
    the trigger's own internal `UPDATE ... SET status = 'EXPIRED'`
    re-triggering itself). (b) Adds `bookings.anon_id` (a random id set in
    a cookie on first visit to the booking flow, see `lib/anon-session.ts`)
    and caps active un-completed holds per anonymous visitor per business
    at 2 (`MAX_ACTIVE_HOLDS_PER_VISITOR` in `book/actions.ts`) — quick
    booking otherwise lets one visitor grab every remaining slot in a day
    with zero contact info attached, making a business look fully booked
    when it isn't.
  - `015_manual_booking_and_blocks.sql`: `bookings.created_by_staff` (a
    flag, no behavior change) and `staff_blocks` — a staff member marking
    themselves unavailable (lunch, a meeting) without a fake booking.
    `staff_blocks` has its own EXCLUDE constraint against itself, same
    shape as `bookings`'/`class_sessions`'; a staff member's time is now
    genuinely spoken for across three separate tables, each fully
    protected against itself but not against the other two by the
    database alone — see `lib/staff-availability.ts`, the shared
    cross-table pre-check every insert into any of the three now runs
    (also closes a real gap found while building this: creating a class
    session never checked for a conflicting 1:1 booking at all, since
    `class_sessions`' own exclusion constraint only ever guarded it
    against *other* class sessions).
  - `016_line_notifications.sql`: `customers.line_user_id` — a LINE user
    id can only be obtained by a customer actually connecting their
    account (LINE Login), never derived from their phone/email, so this
    is additive to the existing customer record rather than a new
    identity table.
  - `017_customer_accounts.sql`: `customers.password_hash` and
    `customer_sessions` — real customer accounts, scoped per business
    (same shape as `owners`/`sessions` from `009_auth.sql`, not RLS'd for
    the same reason: looking someone up by email/session token
    necessarily precedes knowing their business). Deliberately not a
    unified cross-tenant identity — a customer signs up/logs in on one
    specific shop's booking site and sees only their bookings with that
    shop, matching how `customers` already dedupes per business, not
    globally. Quick-booking (no account) is untouched by this — both
    coexist, and signing up later claims the existing quick-booked
    customer record by matching email rather than creating a disconnected
    second one.
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
  business's public slug (e.g. `/book/velure-demo-spa`). **Quick booking**:
  choose a service → picking a time reserves it immediately
  (`createQuickHold`, no contact info yet — `customer_id` is nullable on
  `bookings` for exactly this) → `.../details/[bookingId]` collects name/
  phone/email and attaches them to the existing hold
  (`completeBookingDetails`) → pay via PromptPay or card (or skip straight
  to confirmed for free services) → `src/app/api/stripe/webhook` confirms
  it. This is the actual MVP core loop from docs/ARCHITECTURE.md, integrated
  for real (not just proven standalone like the spike). `/book/pay/[id]`
  and `/book/confirmed/[id]` stay unscoped by slug — reached by an
  unguessable booking id, not by business. Customer-facing pages use a
  wider two-column layout on desktop (image/summary on the left, the
  actual picker/form on the right) rather than a single centered mobile-
  width column stretched across a full monitor — collapses to one column
  below `lg`.
- **Service customization**: `services.description`/`services.image_url`
  (owner-editable via an "Edit" panel on `/dashboard/services`, shown to
  customers on the service list and detail pages) and
  `service_custom_fields` — owner-defined extra questions per service
  (e.g. "Any allergies?"), each with an `importance` of `optional`,
  `important` (shown with a badge, doesn't block submit), or `required`
  (blocks submit — enforced both client-side, disabling the button, and
  server-side in `completeBookingDetails`, since this is a public
  unauthenticated endpoint and the client's copy of which fields are
  required could be stale or bypassed). Answers land in
  `booking_field_responses`, which snapshots the field's label/importance
  at booking time rather than joining live to `service_custom_fields`, so
  editing or deleting a question later never rewrites what a past customer
  was actually asked.
- `/book/manage/[bookingId]` — customer self-service reschedule/cancel,
  same unguessable-id-as-auth pattern as `/book/pay` and `/book/confirmed`
  (the id itself, long and random, stands in for a session, so this page
  needs no login and works identically for a quick-booking guest or a
  signed-up customer). `src/app/book/manage/[bookingId]/actions.ts`
  re-validates everything server-side — status is still `CONFIRMED`, and
  enough hours remain per the business's `reschedule_cutoff_hours`/
  `cancel_cutoff_hours` — even though the page only renders the buttons
  when already allowed, because this is a public link and the page could
  be stale by the time it's clicked. Reschedule reuses `getAvailableSlots`
  (now taking an optional `excludeBookingId` so the booking being moved
  doesn't block its own current slot) and, like the original booking flow,
  catches Postgres `23P01` (the overlap EXCLUDE constraint) on the UPDATE
  itself — a slot can still lose a race after the slot list was fetched.
- `/book/[slug]/{signup,login,account}` — real customer accounts, per
  business (see migration 017's note on why per-business, not unified).
  `lib/customer-auth.ts` mirrors `lib/auth.ts`'s owner-auth code almost
  exactly (scrypt hashing straight-up reused, not reimplemented; opaque
  session tokens in an httpOnly cookie, `velure_customer_session` — a
  distinct cookie from the owner's `velure_session`, so being logged in as
  an owner and a customer in the same browser doesn't collide) but
  `requireCustomer(slug, businessId)` additionally checks the logged-in
  customer's `business_id` matches the shop whose page they're on, not
  just "is someone logged in" — a session from shop A means nothing on
  shop B's booking site. `/account` lists every booking for that customer
  (RLS-scoped by business even though the customer id already came from a
  verified session — defense in depth, same as everywhere else) and links
  each one to the *same* `/book/manage/[bookingId]` page guest customers
  already use, rather than duplicating reschedule/cancel UI. Signing up
  claims an existing quick-booked customer record by matching email
  (setting `password_hash` on it if none exists yet) rather than creating
  a disconnected second one. `BookingHeader` shows "My bookings" / "Log in"
  on every `/book/*` page (itself now an async Server Component that
  checks the session, rather than every one of its ~9 call sites having
  to fetch and pass it down).
- `src/lib/email.ts` — fire-and-forget booking confirmation email via
  Resend. Every call site (`book/actions.ts`'s free-service instant-confirm
  path, and the Stripe webhook's `payment_intent.succeeded` handler) treats
  this as best-effort: no `RESEND_API_KEY` just logs and skips, and a send
  failure is caught and logged, never thrown — the booking itself is already
  real by the time this runs, so email must never be able to break it. Needs
  `RESEND_API_KEY` (and optionally `RESEND_FROM_EMAIL`, `APP_BASE_URL`) in
  `.env.local` — **not yet tested against a live send**, only verified to
  type-check and to correctly skip when the key is absent.
- `src/lib/line.ts` + `src/app/api/line/connect|callback/` — LINE OA
  booking-confirmation notifications, the highest-priority post-MVP item
  named in an external review specifically for the Thai market. A
  customer's LINE user id isn't derivable from anything already on file,
  so it needs its own connect flow: `/book/manage/[bookingId]` shows a
  "Connect LINE" link (only when `LINE_LOGIN_CHANNEL_ID` is configured —
  hidden entirely otherwise, not shown disabled) that starts LINE Login
  OAuth, keyed by the booking's own unguessable id the same way every
  other public booking-management action is (no customer session exists
  to key it by instead). The callback exchanges the code and verifies the
  id_token via LINE's own `/oauth2/v2.1/verify` endpoint — no local JWT
  library or JWKS handling needed, and no risk of trusting an unverified
  claim — then stores the returned `sub` as `customers.line_user_id`.
  `sendLineBookingConfirmation` mirrors `email.ts`'s fire-and-forget
  contract exactly (same call sites, same "missing config = skip" and
  "failure = log, never throw" behavior) and needs
  `LINE_LOGIN_CHANNEL_ID`/`LINE_LOGIN_CHANNEL_SECRET` (the Login channel)
  plus `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` (the Messaging API channel —
  both belong to the same LINE Official Account) in `.env.local` —
  **not yet tested against a real LINE account**, only verified to
  type-check, to correctly return 501/skip when unconfigured, and that
  the connect UI stays hidden rather than showing a dead link.
- `src/lib/availability.ts` — computes open slots for a service/date from
  real `business_hours` and `staff_hours` (a weekday can be closed
  entirely, and a staff member's own shift plus one optional break window
  further narrows the business's hours — the effective window is the
  overlap of both, so a staff member is never bookable outside their own
  shift even if the shop is open later). The slot list is still a UI
  convenience only — the database's overlap EXCLUDE constraint is what
  actually prevents double-booking, so a stale slot losing a race just
  surfaces as "that time was just taken." Also excludes bookings whose
  `hold_expires_at` has already passed even if their `status` hasn't been
  swept to `EXPIRED` yet (see next point) — a read can land between two
  writes and see a not-yet-swept abandoned hold.
- **Stale-hold sweeping**: quick booking makes abandoned holds more likely
  (a slot can now be locked with zero contact info attached), and the
  EXCLUDE constraint only checks `status`, not `hold_expires_at` — so
  `createQuickHold` sweeps this business's own expired
  `TEMPORARY_HOLD`/`PAYMENT_PENDING` rows to `EXPIRED` immediately before
  every insert attempt. Cheap (indexed on `business_id`) and means an
  abandoned hold can never block a slot forever, without needing an
  external cron/scheduler.
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
  Each team member has an "Hours" panel to set their own weekly working
  hours and one optional break per day (`updateStaffHours` in
  `staff/actions.ts`), read by `availability.ts`. Setting a service's
  capacity to 2+ (also on this page) marks it a class — see `classes/`.
  The same panel also has a "Blocked time" section (`createStaffBlock`/
  `deleteStaffBlock`) — lunch, a meeting, anything that should make a
  staff member unbookable without a fake booking; read by
  `availability.ts` the same way class sessions are.
- `src/app/dashboard/bookings/` also has a "+ New booking" form
  (`NewBookingForm.tsx`, `createManualBooking` in `actions.ts`) — real
  shops keep taking bookings by phone/LINE/walk-in regardless of what
  online flow exists, and Velure only actually prevents double-booking if
  those get entered into the same system. Skips the online hold→pay flow
  entirely and goes straight to `CONFIRMED` (a staff member creating this
  is presumed to be collecting payment themselves), reuses the same
  customer-upsert-by-phone logic as the online flow, and is guarded by the
  same `isStaffFreeForRange` pre-check plus the real EXCLUDE constraint on
  insert.
- `src/app/dashboard/classes/` — schedule sessions for class-type services
  (pick the service, a staff member, a date/time — end time comes from the
  service's duration). Removing a session with existing bookings is
  blocked the same way deleting a service/staff member with bookings is.
  `src/lib/classes.ts` holds `claimClassSeat`/`releaseClassSeat`, the
  atomic capacity guard (`UPDATE ... WHERE seats_booked < capacity`, same
  race-safety idea as the 1:1 flow's exclusion constraint, just a counter
  instead of a range check) — every place a class-attendee booking leaves
  an active status (hold expiry, payment failure, cancellation from either
  `/book/manage` or the dashboard) releases the seat through it, or seats
  permanently leak away.
- `src/app/book/[slug]/[serviceId]/` — branches on the service's capacity:
  a normal service still gets `BookingWizard`'s dynamic day/time picker;
  a class-type service gets `ClassSessionPicker` instead, listing the
  owner's scheduled sessions with seats remaining. Reserving a seat
  (`reserveClassSeat` in `book/actions.ts`) creates an ordinary
  `TEMPORARY_HOLD` booking tagged with the session and flows into the
  *exact same* details/payment/confirmation pages as a 1:1 booking — the
  only thing that differs is how the hold was created. Class bookings
  can't be rescheduled via `/book/manage` (their time belongs to the whole
  session, not one attendee) — cancel and book a different session
  instead; they can still be cancelled normally.
- `src/app/dashboard/settings/` — business profile (name, type, logo,
  description, address, contact info — the description/address/contact
  also show on the public booking page) and weekly opening hours, per
  weekday, with a "closed" toggle. Both feed `availability.ts` directly;
  there's no cache to invalidate beyond Next's own route revalidation.
  Also has "Payments" (`PaymentsSection.tsx`, `stripe-actions.ts`):
  `connectStripeAccount` creates a Standard connected account via the API
  directly (not OAuth — proven in the Connect spike; TH platforms can't
  use Express/Custom) the first time, then always generates a fresh
  Stripe-hosted `account_onboarding` link and redirects there, so it also
  works as "finish/resume setup" for an account that exists but hasn't
  completed onboarding. The page checks `charges_enabled` live via the
  Stripe API on every load rather than caching it, so returning from
  Stripe's hosted flow reflects immediately.
- `src/app/dashboard/bookings/` — List / Day / Week / Month views (`?view=`
  + `?date=` in the URL, so every view is linkable). All four read through
  `src/lib/bookings-data.ts`'s shared `getBookingsInRange`; Month/Week fetch
  exactly the date range their own grid renders (a mismatch here would
  silently blank out real bookings on adjacent-month days). Status actions
  (Complete/No-show/Cancel) validate the transition server-side against a
  fixed allow-list (`ALLOWED_TRANSITIONS` in `bookings/actions.ts`) — never
  trust a status string from the client beyond picking among those. Any
  booking with a real payment (`RefundButton.tsx`) can be refunded, full
  or partial — deliberately a manual, explicit owner action rather than
  something automatic on cancel, since refund policy varies by business
  and this app doesn't model one. `refundBooking` in `actions.ts` calls
  `stripe.refunds.create` against the connected account directly (same
  direct-charge model as the original payment), then sets the booking to
  `REFUNDED` or `PARTIALLY_REFUNDED` — both already existed in the
  `booking_status` enum from day one but were never actually used until
  this.
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

The customer-facing `/book/*` flow uses a wider two-column desktop layout
(see the "App structure" section above) plus a spacing pass — larger card
padding (p-6), wider gaps between fields/buttons, and fewer, bigger
columns in the time-slot grids on narrow screens (2 columns on phones
instead of 3-4) — after feedback that it read as cramped on a full
monitor. Verified live at both 390px and 1440px, including the class
session picker and details form.

The owner dashboard is responsive too: below `lg`, `Sidebar.tsx` collapses
from the always-visible 224px rail to a slim top bar with a hamburger
button opening a slide-over drawer with the same nav — the fixed rail ate
close to half the screen on a phone otherwise, and most owners running a
small shop will manage it from one. Card/row layouts on Services, Team,
and Classes that used an unconstrained `flex justify-between` (fine on
desktop, but let the left content push the right side into a cramped
sliver on a narrow screen) now stack vertically below `sm`. Verified live
at 390px: drawer opens/closes/navigates, cards stack cleanly.

## What exists vs. doesn't yet

Done: full MVP data model, RLS, booking-overlap prevention, real
per-business auth (signup creates an isolated business + owner + public
booking slug immediately — verified live with two separate accounts, zero
data bleed between them), an owner dashboard on real data (incl. a booking
status donut), the full booking → hold → payment (PromptPay **or** card) →
webhook → confirmed loop working end to end in the real app, owner-side
management (services, staff, a full calendar with status actions, reports
with CSV export + print), customer self-service reschedule/cancel with
per-business cutoff policy (verified live, including the "too close to
start time, blocked" path), per-service customization (description,
photo, owner-defined required/important/optional booking-form questions —
verified live end to end, including the required-field submit block and
the answers landing in the database), and a real business Settings page
(profile + per-weekday opening hours) plus per-staff weekly hours and
break windows, both wired directly into `availability.ts` (verified via
direct calls: a closed weekday and a staff break both correctly zero out
those slots) — this replaces the old hardcoded-09:00–19:00 stub entirely.
Also done: multi-seat class bookings (owner schedules sessions with a
capacity, customers book a seat, atomic overbooking protection, seats
released back on cancel/expiry/payment-failure — verified directly:
filled a 3-seat class to capacity, confirmed a 4th reservation was
refused, cancelled one attendee and confirmed the freed seat could be
re-claimed, and confirmed a 1:1 hold can't be created over an active
class session's time). Also done, after an external architecture review:
expired-hold sweeping moved from an application-remembered call into a
DB trigger (verified: a stale hold inserted with no app code involved
still gets cleared by an unrelated insert for the same staff), a cap on
un-completed holds per anonymous visitor (verified live: a 3rd hold is
refused without touching the slot), manual booking by staff for
phone/walk-in customers (verified live, including that it's rejected
when it conflicts with an existing booking), and staff block time for
lunch/meetings/etc. (verified live: a block removes those times from the
public booking page, and creating a block that conflicts with something
else is rejected the same way a conflicting booking is). Also done:
Stripe self-onboarding for a newly signed-up business (`/dashboard/settings`
→ "Connect Stripe" creates a real Standard connected account and sends
the owner through Stripe's own hosted onboarding — no more attaching one
by hand) and owner-triggered refunds, full or partial, on any paid
booking (`RefundButton.tsx` on the Bookings list). Both verified against
the real Stripe test-mode API: created a live connected account and
completed a real card payment, then issued a genuine partial refund and
confirmed both the booking's status and the actual Stripe refund object.
Booking confirmation emails and LINE OA notifications are both coded and
wired into the same confirmation paths but genuinely untested — no
`RESEND_API_KEY` or LINE Developer credentials supplied yet. The LINE
Login connect flow itself (the part that doesn't need a real LINE account
to verify) has been checked live: the connect endpoint correctly refuses
with 501 and the "Connect LINE" UI stays hidden entirely when
unconfigured, rather than either failing loudly or showing a dead link.
Also done: real per-business customer accounts (`/book/[slug]/signup`,
`/login`, `/account`) so a registered customer can see every booking
they've made with a shop in one list rather than hunting down each
confirmation email — every reschedule/cancel action still runs through
the same `/book/manage/[bookingId]` page guest customers already use, not
a duplicate. Verified live end to end: signed up, booked, confirmed the
booking appeared in the account list and linked to the correct manage
page, logged out, and logged back in successfully; also confirmed
`/account` redirects to `/login` when not signed in.

Not started: customers CRUD UI *for owners* (only `db/seed.ts` and
customers signing themselves up can create these — there's still no
dashboard page for an owner to browse/add/edit customers directly), AI
onboarding, embed widget, and Velure's own SaaS subscription billing
(charging business owners monthly/yearly — discussed, not designed).
Known gaps: refunds are manual only (no automatic refund on cancel, since
refund policy varies by business and isn't modeled) and support one
refund per booking (no second partial refund on top of a first); Stripe
onboarding status is checked live on every Settings page load rather than
cached or kept in sync via an `account.updated` webhook; class-booking
custom fields aren't supported yet
(the required/important/optional questions feature only applies to 1:1
services); an owner can't cancel a whole class session that has existing
attendee bookings (must cancel each attendee first, same restriction as
deleting a service/staff member with bookings); a class's capacity can
only be set at creation, not edited afterward. The class-scheduling and
session-picker UI has since been click-tested live (both desktop and
390px mobile) on top of the earlier direct-database verification —
reserved a seat through the actual customer flow and confirmed it landed
on the same details page a 1:1 booking would.

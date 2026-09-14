# Velure — web app

Next.js 16 (App Router) + Postgres. This is the real product, built after
all 4 Phase 0 proof spikes (`../spikes/`) passed.

**Note**: This Next.js version has real breaking changes from older
versions — see `AGENTS.md` / `node_modules/next/dist/docs/` before writing
app code that assumes older conventions.

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
- `src/db/client.ts` — `appPool` (the non-superuser `app_user` role RLS
  actually applies to) and `withBusinessContext(businessId, fn)`, which
  every business-scoped query should go through. `adminPool` bypasses RLS
  entirely — only for migrations/seeding/the Stripe webhook's initial
  "which business owns this account?" lookup.
- `src/db/smoke-test.ts` — re-run after any schema change touching RLS or
  the booking table's constraints. Its cleanup runs in a `finally` block on
  purpose: an earlier version let a mid-run failure skip cleanup and leave
  a stray business row behind, which silently broke the dashboard (it was
  picked up as "the oldest business" by the temporary demo-business stub).

## App structure

- `src/app/dashboard/` — the owner dashboard (today's bookings, month
  revenue, upcoming appointments, a monthly revenue chart). Currently the
  only real page; `/` redirects here.
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

## What exists vs. doesn't yet

Done: full MVP data model (businesses, staff, resources, services,
customers, bookings with the full state machine), RLS, booking-overlap
prevention, an owner dashboard reading real (seeded) data.

Not started: any other pages (bookings list, services, staff, customers),
booking creation UI, the Stripe payment flow wired into the real app
(proved standalone in `../spikes/stripe-connect-promptpay`, not yet
integrated here), AI onboarding, embed widget, notifications, real auth.

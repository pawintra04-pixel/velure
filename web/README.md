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
npm run db:seed        # creates a demo business/staff/service
npm run db:smoke-test  # verifies RLS + booking-overlap constraints work

npm run dev             # http://localhost:3000
```

## Database

- `db/migrations/*.sql` — applied in filename order, tracked in
  `schema_migrations`. See each file's comments for the reasoning; several
  directly carry over patterns proven in `../spikes/`:
  - `002_app_role_and_helpers.sql` / `007_row_level_security.sql`:
    tenant isolation via Postgres RLS, same pattern as
    `../spikes/tenant-isolation`.
  - `006_bookings.sql`: double-booking prevention, upgraded from the
    spike's exact-timestamp unique index to a `tstzrange` overlap
    EXCLUDE constraint (real services have duration + buffer, so two
    bookings can collide without sharing an identical start time).
- `db/client.ts` — `appPool` (the non-superuser `app_user` role RLS
  actually applies to) and `withBusinessContext(businessId, fn)`, which
  every business-scoped query should go through. `adminPool` bypasses RLS
  entirely — only for migrations/seeding/the Stripe webhook's initial
  "which business owns this account?" lookup.
- `db/smoke-test.ts` — re-run after any schema change touching RLS or the
  booking table's constraints.

## What exists vs. doesn't yet

Done: full MVP data model (businesses, staff, resources, services,
customers, bookings with the full state machine), RLS, booking-overlap
prevention.

Not started: any API routes, UI, the Stripe payment flow wired into the
real app (proved standalone in `../spikes/stripe-connect-promptpay`, not
yet integrated here), AI onboarding, embed widget, notifications.

# Spike: Tenant isolation — RESULT

**Status: PASS**

## What was tested

The architecture doc requires isolation to be enforced at server **and**
database level — not just "the frontend doesn't show other shops' data."
This spike goes further than an app-level `WHERE business_id = ?` check: it
uses real Postgres Row-Level Security (RLS) so that even a query the app
writes incorrectly still can't cross tenants.

Setup (`src/schema.sql`):
- `bookings` table with `business_id`, RLS **enabled and forced**
  (`FORCE ROW LEVEL SECURITY` — without `FORCE`, RLS doesn't even apply to
  the table owner).
- A non-superuser `app_user` role is what the application actually connects
  as. This matters: superusers and any role with `BYPASSRLS` skip RLS
  unconditionally, regardless of `FORCE`. If the app pool connected as the
  setup superuser, this entire spike would silently prove nothing.
- One policy: a row is visible only if `business_id` matches a per-session
  Postgres GUC, `app.current_business_id`, set via `set_config(..., true)`
  (transaction-local, equivalent to `SET LOCAL`) at the start of each
  request's transaction — simulating an auth middleware stamping the
  authenticated tenant onto the DB session before any query runs.

## Scenarios (`src/run.ts`)

1. **Unscoped query** — business A's session runs `SELECT * FROM bookings`
   with no `WHERE` at all (simulating a lazy/buggy handler). RLS alone
   limits it to A's row.
2. **Tampered parameter** — session is authenticated as business A, but the
   query explicitly filters `WHERE business_id = $1` with **business B's**
   id (the exact attack the architecture doc calls out: changing the
   business ID in the request). Result: 0 rows — the session GUC overrides
   whatever the query claims.
3. **No session context at all** — no GUC set (e.g. a raw connection, or an
   auth middleware bug). Result: 0 rows, not all rows. Fails closed.
4. **Business B, for symmetry** — proves isolation both directions, not just
   one tenant's side.

All four passed.

## A real footgun found and fixed along the way

The first version of the policy used
`business_id = current_setting('app.current_business_id', true)::uuid`
and **scenario 3 crashed** with `invalid input syntax for type uuid: ""`
instead of returning zero rows.

Cause: `current_setting(name, true)` returns `NULL` only if the custom GUC
was *never declared* on that connection. But once any transaction on a
pooled connection does `SET LOCAL app.current_business_id = ...`, Postgres
creates a placeholder for that undeclared custom parameter — and when the
`LOCAL` scope ends, it reverts to `''` (empty string), not `NULL`. Casting
`''::uuid` throws. On a connection pool, this bites the very next request
that forgets to set the GUC, unpredictably, since it depends on what a
previous request on the same pooled connection happened to do.

Fix: wrap in `NULLIF(current_setting(...), '')::uuid` so both "never set"
and "reverted to empty" fold to `NULL`, which fails closed (zero rows)
without throwing.

**Carry into the real schema**: any RLS policy that casts a GUC to a typed
column must use this `NULLIF(..., '')` guard, or a pooled connection will
occasionally 500 instead of cleanly denying.

## Run it yourself

```bash
cd spikes/tenant-isolation
npm install
npm start
```

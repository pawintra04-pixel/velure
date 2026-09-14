# Spike: Atomic booking — RESULT

**Status: PASS**

## What was tested

The architecture doc requires that double-booking be rejected at the database
level, not the application level, because two customers can hit checkout for
the same slot in the same millisecond.

This spike:
1. Spins up a real embedded PostgreSQL 18 instance (no external services, no
   Docker/Homebrew required — via the `embedded-postgres` npm package).
2. Creates a `bookings` table with a **partial unique index** on
   `(staff_id, start_time)` scoped to slot-occupying statuses
   (`TEMPORARY_HOLD`, `PAYMENT_PENDING`, `CONFIRMED`) — see `src/schema.sql`.
3. Fires 20 concurrent `holdSlot()` calls at the exact same staff/time slot,
   each wrapped in its own transaction.
4. Catches Postgres error `23505` (unique violation) as the expected
   "slot taken" outcome rather than a bug.

## Result

- App-level: 1 succeeded, 19 rejected as `slot_taken`.
- DB-level: exactly 1 row persisted for that slot.

The partial unique index approach works and is cheap: no advisory locks, no
`SELECT ... FOR UPDATE` polling, no application-level mutex. Postgres itself
is the single source of truth for "is this slot taken."

## Carry into the real schema

- Use the same partial unique index pattern for the real `bookings` table.
- The set of statuses in the `WHERE` clause of the index **is** the
  "slot-occupying" definition — keep it in sync with the state machine in
  `docs/ARCHITECTURE.md` if statuses change.
- Catch and handle Postgres error code `23505` specifically at the
  hold-creation call site; don't let it bubble up as a generic 500.

## Run it yourself

```bash
cd spikes/atomic-booking
npm install
npm start
```

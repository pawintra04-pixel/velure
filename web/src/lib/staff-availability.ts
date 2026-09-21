import type { PoolClient } from "pg";

/**
 * True when `err` is Postgres rejecting an insert/update because it lost a
 * genuine race for a slot — either the EXCLUDE constraint firing directly
 * (23P01) or a deadlock between two transactions that both held a
 * conflicting lock at the same instant (40P01, verified reachable under
 * real concurrent load: two simultaneous booking attempts for the same
 * staff/time can deadlock rather than one cleanly losing to the exclusion
 * constraint). Both mean the same thing to the caller — the slot is taken,
 * try a different one — and should produce the same friendly error instead
 * of "something went wrong" plus a spurious console.error for an outcome
 * that's a normal, expected result of two people booking at once.
 */
export function isSlotConflictError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === "23P01" || code === "40P01";
}

/**
 * A staff member's time is now spoken for by three independent tables
 * (bookings, class_sessions, staff_blocks), each with its own EXCLUDE
 * constraint guarding overlaps *within itself* — Postgres can't express a
 * single constraint spanning tables. This is the shared cross-table check
 * every insert into any of the three should run first: it narrows the
 * race window (checked inside the same transaction as the insert that
 * follows) but, unlike a same-table EXCLUDE constraint, isn't fully
 * atomic — a conflicting insert into a *different* one of the three
 * tables at the same instant is a real, if narrow, possibility. Each
 * table's own EXCLUDE constraint still fully protects it against itself.
 *
 * The bookings leg excludes logically-expired holds (hold_expires_at in
 * the past) even though they still carry TEMPORARY_HOLD/PAYMENT_PENDING —
 * this runs as a plain SELECT before the sweep-on-insert trigger (migration
 * 014) has a chance to fire, so without this filter a slot whose only
 * occupant is a hold nobody ever paid would read back as falsely taken.
 */
export async function isStaffFreeForRange(
  c: PoolClient,
  staffId: string,
  startTime: string,
  endTime: string,
  excludeBookingId?: string
): Promise<boolean> {
  const { rows: [conflict] } = await c.query(
    `SELECT 1 FROM bookings
       WHERE staff_id = $1
         AND status IN ('TEMPORARY_HOLD', 'PAYMENT_PENDING', 'CONFIRMED')
         AND (hold_expires_at IS NULL OR hold_expires_at >= now())
         AND tstzrange(start_time, end_time) && tstzrange($2, $3)
         AND ($4::uuid IS NULL OR id != $4::uuid)
     UNION ALL
     SELECT 1 FROM class_sessions
       WHERE staff_id = $1 AND tstzrange(start_time, end_time) && tstzrange($2, $3)
     UNION ALL
     SELECT 1 FROM staff_blocks
       WHERE staff_id = $1 AND tstzrange(start_time, end_time) && tstzrange($2, $3)
     LIMIT 1`,
    [staffId, startTime, endTime, excludeBookingId ?? null]
  );
  return !conflict;
}

import type { PoolClient } from "pg";

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

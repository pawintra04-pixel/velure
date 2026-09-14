import type { PoolClient } from "pg";

/**
 * A class session's seats_booked counter is the actual capacity guard (see
 * db/migrations/013_class_sessions.sql) — every place a class-attendee
 * booking leaves an active status (expires, gets cancelled, fails payment)
 * must release its seat back through here, or seats permanently leak away
 * and a class that should have room shows as full forever.
 */
export async function releaseClassSeat(c: PoolClient, classSessionId: string): Promise<void> {
  await c.query(`UPDATE class_sessions SET seats_booked = seats_booked - 1 WHERE id = $1`, [
    classSessionId,
  ]);
}

/**
 * Atomically claims one seat: fails (returns false) rather than
 * overbooking if another request claimed the last seat first. Race-safe
 * for the same reason `createQuickHold`'s exclusion constraint is — the
 * WHERE clause and the increment happen as one statement, not a
 * read-then-write.
 */
export async function claimClassSeat(c: PoolClient, classSessionId: string): Promise<boolean> {
  const { rows } = await c.query(
    `UPDATE class_sessions SET seats_booked = seats_booked + 1
     WHERE id = $1 AND seats_booked < capacity
     RETURNING id`,
    [classSessionId]
  );
  return rows.length > 0;
}

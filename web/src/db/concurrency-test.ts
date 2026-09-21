import { randomUUID } from "node:crypto";
import { adminPool, withBusinessContext } from "./client";
import { isStaffFreeForRange, isSlotConflictError } from "../lib/staff-availability";

/**
 * Fires N genuinely concurrent booking attempts at the SAME staff+time slot
 * against the real schema and the real app code (withBusinessContext,
 * isStaffFreeForRange, isSlotConflictError — unmodified imports from
 * src/lib and src/db, not reimplemented copies), reproducing
 * createQuickHold's transaction body (src/app/book/actions.ts) exactly,
 * minus the cookie-based anon_id lookup (replaced with N distinct ids,
 * modeling N different visitors racing for one slot rather than one
 * visitor's own rate limit).
 *
 * This exists because the only prior concurrency evidence was
 * spikes/atomic-booking (a throwaway schema, proven once before the real
 * app existed) and smoke-test.ts (sequential, not concurrent). Neither
 * proves the shipped schema + shipped error-handling path actually holds
 * up when requests genuinely race, which is the roadmap's Phase 0 bar.
 *
 * Run: npx tsx src/db/concurrency-test.ts
 */

const CONCURRENT_ATTEMPTS = 25;

async function attemptBooking(
  businessId: string,
  serviceId: string,
  staffId: string,
  startTime: string,
  endTime: string,
  anonId: string
): Promise<{ ok: true; bookingId: string } | { ok: false; reason: "slot_taken" | "unexpected"; detail?: unknown }> {
  try {
    const bookingId = await withBusinessContext(businessId, async (c) => {
      if (!(await isStaffFreeForRange(c, staffId, startTime, endTime))) {
        throw new Error("slot_taken");
      }
      const { rows: [booking] } = await c.query(
        `INSERT INTO bookings
           (business_id, service_id, staff_id, start_time, end_time, status, hold_expires_at, amount, anon_id)
         VALUES ($1, $2, $3, $4, $5, 'TEMPORARY_HOLD', $6, $7, $8)
         RETURNING id`,
        [businessId, serviceId, staffId, startTime, endTime, new Date(Date.now() + 10 * 60_000), 0, anonId]
      );
      return booking.id;
    });
    return { ok: true, bookingId };
  } catch (err) {
    if (isSlotConflictError(err) || (err as Error).message === "slot_taken") {
      return { ok: false, reason: "slot_taken" };
    }
    return { ok: false, reason: "unexpected", detail: err };
  }
}

async function main() {
  console.log(`Setting up a disposable test business (${CONCURRENT_ATTEMPTS} concurrent attempts at one slot)...`);

  const { rows: [business] } = await adminPool.query(
    `INSERT INTO businesses (name, slug) VALUES ($1, $2) RETURNING id`,
    [`Concurrency Test ${randomUUID().slice(0, 8)}`, `concurrency-test-${randomUUID().slice(0, 8)}`]
  );
  const businessId = business.id;

  const { rows: [staff] } = await adminPool.query(
    `INSERT INTO staff (business_id, name) VALUES ($1, 'Test Staff') RETURNING id`,
    [businessId]
  );
  const { rows: [service] } = await adminPool.query(
    `INSERT INTO services (business_id, name, duration_minutes, price_amount, payment_mode)
     VALUES ($1, 'Test Service', 60, 0, 'free') RETURNING id`,
    [businessId]
  );
  await adminPool.query(`INSERT INTO staff_services (business_id, staff_id, service_id) VALUES ($1, $2, $3)`, [
    businessId,
    staff.id,
    service.id,
  ]);

  const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();

  console.log(`Firing ${CONCURRENT_ATTEMPTS} concurrent attempts at the identical slot...`);
  const results = await Promise.all(
    Array.from({ length: CONCURRENT_ATTEMPTS }, (_, i) =>
      attemptBooking(businessId, service.id, staff.id, startTime, endTime, `test-visitor-${i}`)
    )
  );

  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok) as Extract<(typeof results)[number], { ok: false }>[];
  const slotTaken = failed.filter((r) => r.reason === "slot_taken");
  const unexpected = failed.filter((r) => r.reason === "unexpected");

  const { rows: [{ count: dbRowCount }] } = await adminPool.query<{ count: string }>(
    `SELECT count(*) FROM bookings WHERE staff_id = $1 AND start_time = $2`,
    [staff.id, startTime]
  );

  console.log(`\nResults:`);
  console.log(`  succeeded:        ${succeeded.length}`);
  console.log(`  slot_taken:       ${slotTaken.length}`);
  console.log(`  unexpected error: ${unexpected.length}`);
  console.log(`  rows actually in DB for this slot: ${dbRowCount}`);

  if (unexpected.length > 0) {
    console.log(`\nUnexpected errors (first 3):`);
    for (const r of unexpected.slice(0, 3)) console.log(r.detail);
  }

  console.log(`\nCleaning up test business...`);
  await adminPool.query(`DELETE FROM bookings WHERE business_id = $1`, [businessId]);
  await adminPool.query(`DELETE FROM staff_services WHERE business_id = $1`, [businessId]);
  await adminPool.query(`DELETE FROM services WHERE business_id = $1`, [businessId]);
  await adminPool.query(`DELETE FROM staff WHERE business_id = $1`, [businessId]);
  await adminPool.query(`DELETE FROM businesses WHERE id = $1`, [businessId]);

  await adminPool.end();

  const pass = succeeded.length === 1 && Number(dbRowCount) === 1 && unexpected.length === 0;
  console.log(pass ? "\nPASS: exactly one booking won the race, the rest failed gracefully." : "\nFAIL: see results above.");
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

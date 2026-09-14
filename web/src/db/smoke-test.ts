// Sanity check that the migrated schema actually behaves the way
// spikes/tenant-isolation and spikes/atomic-booking proved it should,
// against the REAL app_user role and REAL tables — not the throwaway spike
// schema. Not a full test suite; run ad hoc after schema changes.
import { adminPool, appPool, withBusinessContext } from "./client";

function check(label: string, ok: boolean) {
  console.log(`${ok ? "✅" : "❌"} ${label}`);
  return ok;
}

async function main() {
  const results: boolean[] = [];

  const { rows: [businessA] } = await adminPool.query(
    `SELECT id FROM businesses ORDER BY created_at LIMIT 1`
  );
  const businessAId = businessA.id;

  const { rows: [businessB] } = await adminPool.query(
    `INSERT INTO businesses (name) VALUES ('Other Shop (isolation test)') RETURNING id`
  );
  const businessBId = businessB.id;
  // Everything from here runs inside try/finally: an earlier version of this
  // script let a mid-run failure skip cleanup entirely, leaving this row
  // behind to silently become "the oldest business" for anything (like the
  // dashboard's temporary getDemoBusinessId() stub) that queries businesses
  // ordered by created_at. Cost a real debugging session — see git history.
  let start = "";
  try {

  // 1. RLS: business A's session sees only its own bookings/staff, unscoped query.
  const ownStaff = await withBusinessContext(businessAId, (c) =>
    c.query("SELECT * FROM staff")
  );
  results.push(check("Business A sees its own staff via app_user + RLS", ownStaff.rowCount! > 0));

  const otherBusinessStaff = await withBusinessContext(businessBId, (c) =>
    c.query("SELECT * FROM staff")
  );
  results.push(
    check("Business B (freshly created, no staff) sees zero staff rows", otherBusinessStaff.rowCount === 0)
  );

  // 2. Fails closed with no context at all.
  const noContextClient = await appPool.connect();
  try {
    const r = await noContextClient.query("SELECT * FROM businesses");
    results.push(check("No business context set -> zero rows (fails closed)", r.rowCount === 0));
  } finally {
    noContextClient.release();
  }

  // 3. Overlap exclusion constraint on bookings: two overlapping holds for the
  //    same staff must not both succeed.
  const { rows: [staff] } = await adminPool.query(
    `SELECT id FROM staff WHERE business_id = $1 LIMIT 1`,
    [businessAId]
  );
  const { rows: [service] } = await adminPool.query(
    `SELECT id, price_amount FROM services WHERE business_id = $1 LIMIT 1`,
    [businessAId]
  );

  // Randomized so reruns never collide with a booking a previous run left
  // behind — this script inserts real rows and should be safely rerunnable.
  const day = 1 + Math.floor(Math.random() * 27);
  start = `2026-11-${String(day).padStart(2, "0")}T10:00:00.000Z`;
  const end = `2026-11-${String(day).padStart(2, "0")}T11:00:00.000Z`;
  const overlappingStart = `2026-11-${String(day).padStart(2, "0")}T10:30:00.000Z`; // overlaps, doesn't share exact start_time
  const overlappingEnd = `2026-11-${String(day).padStart(2, "0")}T11:30:00.000Z`;

  await withBusinessContext(businessAId, (c) =>
    c.query(
      `INSERT INTO bookings (business_id, service_id, staff_id, start_time, end_time, amount)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [businessAId, service.id, staff.id, start, end, service.price_amount]
    )
  );

  let secondBookingRejected = false;
  try {
    await withBusinessContext(businessAId, (c) =>
      c.query(
        `INSERT INTO bookings (business_id, service_id, staff_id, start_time, end_time, amount)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [businessAId, service.id, staff.id, overlappingStart, overlappingEnd, service.price_amount]
      )
    );
  } catch (err) {
    secondBookingRejected = (err as { code?: string }).code === "23P01"; // exclusion_violation
  }
  results.push(
    check(
      "Overlapping (not identical) time range for the same staff is rejected by the exclusion constraint",
      secondBookingRejected
    )
  );

  } finally {
    // Runs even if an assertion above throws — see the comment where
    // businessB was created for why this matters.
    await adminPool.query(`DELETE FROM businesses WHERE id = $1`, [businessBId]);
    if (start) {
      await adminPool.query(
        `DELETE FROM bookings WHERE business_id = $1 AND start_time = $2`,
        [businessAId, start]
      );
    }
  }

  const pass = results.every(Boolean);
  console.log(pass ? "\n✅ ALL CHECKS PASS" : "\n❌ SOME CHECKS FAILED");

  await appPool.end();
  await adminPool.end();
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

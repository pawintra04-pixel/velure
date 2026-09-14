import { adminPool } from "./client";
import { hashPassword } from "../lib/auth";

const DEMO_BUSINESS_NAME = "Velure Demo Spa";
const DEMO_SLUG = "velure-demo-spa";
// From spikes/stripe-connect-promptpay — a real Stripe TEST-mode Standard
// connected account, created once by hand (Connect onboarding needs a
// human to click through it). Re-seeding must not lose this, or the
// booking flow's payment step breaks until someone re-attaches it.
const DEMO_STRIPE_ACCOUNT_ID = "acct_1UFRhRECGTB3Jt92";
const DEMO_OWNER_EMAIL = "demo@velure.app";
const DEMO_OWNER_PASSWORD = "password123"; // dev-only demo credentials, see README

// Idempotent: wipes any previous run's demo tree first, so `npm run db:seed`
// is safe to re-run as the schema/seed data evolves during development.
async function wipeExistingDemoData() {
  const { rows } = await adminPool.query(`SELECT id FROM businesses WHERE name = $1`, [
    DEMO_BUSINESS_NAME,
  ]);
  for (const { id: businessId } of rows) {
    await adminPool.query(
      `DELETE FROM sessions WHERE owner_id IN (SELECT id FROM owners WHERE business_id = $1)`,
      [businessId]
    );
    await adminPool.query(`DELETE FROM owners WHERE business_id = $1`, [businessId]);
    await adminPool.query(`DELETE FROM bookings WHERE business_id = $1`, [businessId]);
    await adminPool.query(`DELETE FROM staff_services WHERE business_id = $1`, [businessId]);
    await adminPool.query(`DELETE FROM customers WHERE business_id = $1`, [businessId]);
    await adminPool.query(`DELETE FROM services WHERE business_id = $1`, [businessId]);
    // staff_hours cascades on staff deletion; business_hours doesn't cascade
    // on business deletion (no ON DELETE CASCADE there), so it must go
    // first or the final DELETE FROM businesses hits a FK violation.
    await adminPool.query(`DELETE FROM business_hours WHERE business_id = $1`, [businessId]);
    await adminPool.query(`DELETE FROM staff WHERE business_id = $1`, [businessId]);
    await adminPool.query(`DELETE FROM resources WHERE business_id = $1`, [businessId]);
    await adminPool.query(`DELETE FROM businesses WHERE id = $1`, [businessId]);
  }
}

async function main() {
  await wipeExistingDemoData();

  const { rows: [business] } = await adminPool.query(
    `INSERT INTO businesses (name, slug, timezone, stripe_account_id) VALUES ($1, $2, $3, $4) RETURNING id`,
    [DEMO_BUSINESS_NAME, DEMO_SLUG, "Asia/Bangkok", DEMO_STRIPE_ACCOUNT_ID]
  );
  const businessId = business.id;

  const passwordHash = await hashPassword(DEMO_OWNER_PASSWORD);
  const { rows: [owner] } = await adminPool.query(
    `INSERT INTO owners (business_id, email, password_hash) VALUES ($1, $2, $3) RETURNING id`,
    [businessId, DEMO_OWNER_EMAIL, passwordHash]
  );

  await adminPool.query(
    `INSERT INTO business_hours (business_id, day_of_week, is_closed, open_time, close_time)
     SELECT $1, dow, false, '09:00', '19:00' FROM generate_series(0, 6) AS dow`,
    [businessId]
  );

  const { rows: [staffMember] } = await adminPool.query(
    `INSERT INTO staff (business_id, name) VALUES ($1, $2) RETURNING id`,
    [businessId, "Somchai (Massage Therapist)"]
  );

  await adminPool.query(
    `INSERT INTO staff_hours (business_id, staff_id, day_of_week, is_off, start_time, end_time)
     SELECT $1, $2, dow, false, '09:00', '19:00' FROM generate_series(0, 6) AS dow`,
    [businessId, staffMember.id]
  );

  const { rows: [room] } = await adminPool.query(
    `INSERT INTO resources (business_id, name) VALUES ($1, $2) RETURNING id`,
    [businessId, "Treatment Room 1"]
  );

  const { rows: [service] } = await adminPool.query(
    `INSERT INTO services (business_id, name, duration_minutes, buffer_minutes, price_amount, payment_mode)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [businessId, "Thai Massage (60 min)", 60, 15, 50000, "full"]
  );

  await adminPool.query(
    `INSERT INTO staff_services (business_id, staff_id, service_id) VALUES ($1, $2, $3)`,
    [businessId, staffMember.id, service.id]
  );

  const { rows: [customer] } = await adminPool.query(
    `INSERT INTO customers (business_id, name, phone, email) VALUES ($1, $2, $3, $4) RETURNING id`,
    [businessId, "Somsri", "0812345678", "somsri@example.com"]
  );

  // Past months this year, all settled — gives the dashboard's revenue chart
  // something real to plot. Amounts vary so the chart isn't a flat line.
  const now = new Date();
  const monthlyBookingCounts = [3, 4, 2, 5, 6, 4, 7, 5]; // Jan..Aug-ish, whatever months precede "now"
  let bookingsCreated = 0;
  for (let m = 0; m < monthlyBookingCounts.length; m++) {
    const monthDate = new Date(now.getFullYear(), m, 15);
    if (monthDate >= now) break;
    for (let i = 0; i < monthlyBookingCounts[m]; i++) {
      const day = 3 + i * 3;
      const start = new Date(now.getFullYear(), m, day, 10 + i, 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      await adminPool.query(
        `INSERT INTO bookings
           (business_id, service_id, staff_id, resource_id, customer_id, start_time, end_time, status, amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'COMPLETED', $8)`,
        [businessId, service.id, staffMember.id, room.id, customer.id, start, end, 50000]
      );
      bookingsCreated++;
    }
  }

  // A few upcoming bookings so the dashboard's "upcoming" list and stat
  // tiles (today's bookings, pending payment) have something to show.
  const upcoming: Array<{ hoursFromNow: number; status: string }> = [
    { hoursFromNow: 2, status: "CONFIRMED" },
    { hoursFromNow: 5, status: "CONFIRMED" },
    { hoursFromNow: 26, status: "PAYMENT_PENDING" },
    { hoursFromNow: 50, status: "CONFIRMED" },
  ];
  for (const { hoursFromNow, status } of upcoming) {
    const start = new Date(now.getTime() + hoursFromNow * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    await adminPool.query(
      `INSERT INTO bookings
         (business_id, service_id, staff_id, resource_id, customer_id, start_time, end_time, status, amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [businessId, service.id, staffMember.id, room.id, customer.id, start, end, status, 50000]
    );
    bookingsCreated++;
  }

  console.log("Seeded demo business:");
  console.log({
    businessId,
    ownerId: owner.id,
    ownerEmail: DEMO_OWNER_EMAIL,
    ownerPassword: DEMO_OWNER_PASSWORD,
    bookingUrl: `/book/${DEMO_SLUG}`,
    staffId: staffMember.id,
    resourceId: room.id,
    serviceId: service.id,
    customerId: customer.id,
    bookingsCreated,
  });

  await adminPool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

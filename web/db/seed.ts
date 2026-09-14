import { adminPool } from "./client";

async function main() {
  const { rows: [business] } = await adminPool.query(
    `INSERT INTO businesses (name, timezone) VALUES ($1, $2) RETURNING id`,
    ["Velure Demo Spa", "Asia/Bangkok"]
  );
  const businessId = business.id;

  const { rows: [staffMember] } = await adminPool.query(
    `INSERT INTO staff (business_id, name) VALUES ($1, $2) RETURNING id`,
    [businessId, "หมอนวดสมชาย"]
  );

  const { rows: [room] } = await adminPool.query(
    `INSERT INTO resources (business_id, name) VALUES ($1, $2) RETURNING id`,
    [businessId, "ห้องนวด 1"]
  );

  const { rows: [service] } = await adminPool.query(
    `INSERT INTO services (business_id, name, duration_minutes, buffer_minutes, price_amount, payment_mode)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [businessId, "นวดไทย 60 นาที", 60, 15, 50000, "full"]
  );

  await adminPool.query(
    `INSERT INTO staff_services (business_id, staff_id, service_id) VALUES ($1, $2, $3)`,
    [businessId, staffMember.id, service.id]
  );

  console.log("Seeded demo business:");
  console.log({ businessId, staffId: staffMember.id, resourceId: room.id, serviceId: service.id });

  await adminPool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

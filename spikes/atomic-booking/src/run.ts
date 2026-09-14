import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));

type HoldResult =
  | { ok: true; bookingId: string }
  | { ok: false; reason: "slot_taken" };

async function holdSlot(
  pool: pg.Pool,
  businessId: string,
  staffId: string,
  startTime: string
): Promise<HoldResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO bookings (business_id, staff_id, start_time, status)
       VALUES ($1, $2, $3, 'TEMPORARY_HOLD')
       RETURNING id`,
      [businessId, staffId, startTime]
    );
    await client.query("COMMIT");
    return { ok: true, bookingId: result.rows[0].id };
  } catch (err: any) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      return { ok: false, reason: "slot_taken" };
    }
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const dataDir = mkdtempSync(join(tmpdir(), "velure-pg-"));
  const pg8 = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "velure",
    password: "velure",
    port: 54329,
    persistent: false,
  });

  console.log("Starting embedded Postgres...");
  await pg8.initialise();
  await pg8.start();
  await pg8.createDatabase("velure_spike");

  const pool = new pg.Pool({
    host: "localhost",
    port: 54329,
    user: "velure",
    password: "velure",
    database: "velure_spike",
  });

  try {
    const schema = readFileSync(join(__dirname, "schema.sql"), "utf8");
    await pool.query(schema);
    console.log("Schema applied.\n");

    const businessId = randomUUID();
    const staffId = randomUUID();
    const startTime = "2026-10-01T10:00:00.000Z";

    const CONCURRENCY = 20;
    console.log(
      `Firing ${CONCURRENCY} concurrent holds at the same slot (staff ${staffId}, ${startTime})...`
    );

    const attempts = Array.from({ length: CONCURRENCY }, () =>
      holdSlot(pool, businessId, staffId, startTime)
    );
    const results = await Promise.all(attempts);

    const succeeded = results.filter((r) => r.ok) as Extract<
      HoldResult,
      { ok: true }
    >[];
    const rejected = results.filter((r) => !r.ok);

    console.log(`\nApp-level results: ${succeeded.length} succeeded, ${rejected.length} rejected as slot_taken`);

    const dbCheck = await pool.query(
      `SELECT id, status FROM bookings WHERE staff_id = $1 AND start_time = $2`,
      [staffId, startTime]
    );
    console.log(`Rows actually persisted in DB for this slot: ${dbCheck.rowCount}`);

    const pass = succeeded.length === 1 && dbCheck.rowCount === 1;

    console.log(pass ? "\n✅ PASS — exactly one booking survived the race." : "\n❌ FAIL — double booking or zero bookings occurred.");

    await pool.end();
    await pg8.stop();
    rmSync(dataDir, { recursive: true, force: true });

    process.exit(pass ? 0 : 1);
  } catch (err) {
    await pool.end();
    await pg8.stop();
    rmSync(dataDir, { recursive: true, force: true });
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

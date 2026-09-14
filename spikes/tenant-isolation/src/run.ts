import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Runs `sql` as if it came from an authenticated session scoped to `businessId`.
 *  The GUC is set via set_config(..., true) which behaves like SET LOCAL —
 *  scoped to this one transaction, never leaks to other pooled connections. */
async function queryAsBusiness(
  pool: pg.Pool,
  businessId: string | null,
  sql: string,
  params: any[] = []
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (businessId !== null) {
      await client.query("SELECT set_config('app.current_business_id', $1, true)", [
        businessId,
      ]);
    }
    const result = await client.query(sql, params);
    await client.query("COMMIT");
    return result.rows;
  } finally {
    client.release();
  }
}

function check(label: string, actual: number, expected: number, pass: () => boolean) {
  const ok = pass();
  console.log(`${ok ? "✅" : "❌"} ${label} (got ${actual}, expected ${expected})`);
  return ok;
}

async function main() {
  const dataDir = mkdtempSync(join(tmpdir(), "velure-pg-"));
  const pg8 = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "velure",
    password: "velure",
    port: 54330,
    persistent: false,
  });

  console.log("Starting embedded Postgres...");
  await pg8.initialise();
  await pg8.start();
  await pg8.createDatabase("velure_spike");

  const superuserPool = new pg.Pool({
    host: "localhost",
    port: 54330,
    user: "velure",
    password: "velure",
    database: "velure_spike",
  });

  let appPool: pg.Pool | undefined;
  try {
    const schema = readFileSync(join(__dirname, "schema.sql"), "utf8");
    await superuserPool.query(schema);
    console.log("Schema + RLS policy applied.\n");

    const businessA = randomUUID();
    const businessB = randomUUID();

    // Seed as superuser — superusers always bypass RLS, so this reaches every row
    // regardless of the policy. That's expected: seeding isn't the app's request path.
    await superuserPool.query(
      `INSERT INTO bookings (business_id, customer_name, start_time) VALUES
         ($1, 'Alice (business A)', now()),
         ($2, 'Bob (business B)',   now())`,
      [businessA, businessB]
    );

    appPool = new pg.Pool({
      host: "localhost",
      port: 54330,
      user: "app_user",
      password: "app_user",
      database: "velure_spike",
    });

    const results: boolean[] = [];

    // 1. Legit request, no WHERE clause at all (simulates a lazy/buggy query) —
    //    RLS alone must still scope this to business A's own row.
    const rowsA = await queryAsBusiness(appPool, businessA, "SELECT * FROM bookings");
    results.push(
      check(
        "Business A sees only its own row with an unscoped SELECT *",
        rowsA.length,
        1,
        () => rowsA.length === 1 && rowsA[0].customer_name === "Alice (business A)"
      )
    );

    // 2. Attack: session is authenticated as business A, but the request body/query
    //    param claims business_id = B (e.g. a tampered API parameter). The app's own
    //    WHERE clause trusts that input — this is exactly the vulnerable pattern the
    //    architecture doc warns about. RLS must override it based on the session GUC.
    const tamperedRows = await queryAsBusiness(
      appPool,
      businessA,
      "SELECT * FROM bookings WHERE business_id = $1",
      [businessB]
    );
    results.push(
      check(
        "Session A cannot see business B's row even by passing B's id directly in the query",
        tamperedRows.length,
        0,
        () => tamperedRows.length === 0
      )
    );

    // 3. No session GUC set at all (e.g. auth middleware bug, or a raw psql session
    //    with no app context) — must fail CLOSED (zero rows), never fail open (all rows).
    const noSessionRows = await queryAsBusiness(appPool, null, "SELECT * FROM bookings");
    results.push(
      check(
        "A connection with no business context set sees zero rows (fails closed)",
        noSessionRows.length,
        0,
        () => noSessionRows.length === 0
      )
    );

    // 4. Business B, for symmetry — proves isolation both ways, not just A's side.
    const rowsB = await queryAsBusiness(appPool, businessB, "SELECT * FROM bookings");
    results.push(
      check(
        "Business B sees only its own row",
        rowsB.length,
        1,
        () => rowsB.length === 1 && rowsB[0].customer_name === "Bob (business B)"
      )
    );

    const pass = results.every(Boolean);
    console.log(pass ? "\n✅ PASS — tenant isolation held under every scenario." : "\n❌ FAIL — a cross-tenant leak occurred.");

    process.exitCode = pass ? 0 : 1;
  } finally {
    await appPool?.end();
    await superuserPool.end();
    await pg8.stop();
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import EmbeddedPostgres from "embedded-postgres";
import { join } from "node:path";

// Persistent local Postgres for development — no brew/Docker on this
// machine, so this replaces "run `postgres` locally" for dev purposes.
// Data survives between runs (persistent: true, fixed data dir), unlike the
// throwaway instances the spikes/ used for one-shot proofs.
const dataDir = join(process.cwd(), ".pgdata");

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "velure",
  password: "velure_dev_password",
  port: 54320,
  persistent: true,
});

async function main() {
  await pg.initialise(); // no-ops if dataDir already has a cluster
  await pg.start();

  try {
    await pg.createDatabase("velure_dev");
  } catch {
    // already exists — fine
  }

  console.log("Postgres running on localhost:54320, database velure_dev");
  console.log("DATABASE_URL=postgres://velure:velure_dev_password@localhost:54320/velure_dev");
  console.log("\nCtrl-C to stop.");

  const shutdown = async () => {
    console.log("\nStopping Postgres...");
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

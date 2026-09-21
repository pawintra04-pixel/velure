import { randomBytes } from "node:crypto";
import { adminPool } from "./client";
import { hashPassword } from "../lib/auth";

// One-off bootstrap for the platform operator's own login (src/app/admin) —
// deliberately not a public signup form, since anyone who could self-register
// here would see every business's revenue. Run by hand:
//   npx tsx src/db/create-admin.ts you@example.com [password]
// Omit the password to get a random one printed once. Re-running with the
// same email rotates its password (upsert), so this also works to reset one.
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npx tsx src/db/create-admin.ts <email> [password]");
    process.exit(1);
  }
  const password = process.argv[3] ?? randomBytes(12).toString("base64url");

  const passwordHash = await hashPassword(password);
  await adminPool.query(
    `INSERT INTO platform_admins (email, password_hash) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [email, passwordHash]
  );

  console.log(`platform_admins upserted: ${email}`);
  if (!process.argv[3]) {
    console.log(`Generated password (shown once): ${password}`);
  }
  await adminPool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

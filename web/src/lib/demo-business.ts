import { adminPool } from "@/db/client";

/**
 * STUB until real auth exists: returns the first business in the database
 * ("Velure Demo Spa" from db/seed.ts in dev). Every real page should instead
 * get the business id from the authenticated owner's session. Uses
 * adminPool because there is no session/business context to scope by yet —
 * that's the whole reason this function exists and why it's isolated here
 * rather than sprinkled through page code.
 */
export async function getDemoBusinessId(): Promise<string> {
  // Matched by name, not "oldest business" — a stray row left behind by a
  // crashed test script once silently became "oldest" and made this stub
  // point at an empty business instead of the seeded one. See db/seed.ts
  // and db/smoke-test.ts's cleanup comments.
  const { rows } = await adminPool.query(
    `SELECT id FROM businesses WHERE name = 'Velure Demo Spa' LIMIT 1`
  );
  if (rows.length === 0) {
    throw new Error("Demo business not found — run `npm run db:seed` first.");
  }
  return rows[0].id;
}

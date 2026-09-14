import { adminPool } from "@/db/client";

export type PublicBusiness = { id: string; name: string; slug: string };

/**
 * Resolves a business's public booking-page slug to its id — necessarily
 * via adminPool, not withBusinessContext: we don't know the business id
 * yet, that's the whole point of this lookup (same category of exception
 * as the Stripe webhook and the auth lookups in lib/auth.ts).
 */
export async function getBusinessBySlug(slug: string): Promise<PublicBusiness | null> {
  const { rows: [row] } = await adminPool.query(
    `SELECT id, name, slug FROM businesses WHERE slug = $1`,
    [slug]
  );
  return row ?? null;
}

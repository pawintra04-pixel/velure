import { adminPool } from "@/db/client";

export type PublicBusiness = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  cancel_cutoff_hours: number;
  reschedule_cutoff_hours: number;
};

/**
 * Resolves a business's public booking-page slug to its id — necessarily
 * via adminPool, not withBusinessContext: we don't know the business id
 * yet, that's the whole point of this lookup (same category of exception
 * as the Stripe webhook and the auth lookups in lib/auth.ts).
 */
export async function getBusinessBySlug(slug: string): Promise<PublicBusiness | null> {
  const { rows: [row] } = await adminPool.query(
    `SELECT id, name, slug, logo_url, description, address, contact_phone, contact_email,
            cancel_cutoff_hours, reschedule_cutoff_hours
     FROM businesses WHERE slug = $1`,
    [slug]
  );
  return row ?? null;
}

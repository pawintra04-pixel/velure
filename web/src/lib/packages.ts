import type { PoolClient } from "pg";

// v1 scope note (see 029_packages.sql and the Phase plan): packages are
// sold by the owner in person — cash, or a card/PromptPay payment taken
// outside this app (in person, or however the shop already handles it) —
// not through a new Stripe PaymentIntent flow here. Building a second
// online-charge surface (on top of the one bookings already have) roughly
// doubles the app's payment code for a purchase pattern ("sell a package
// at the counter") that's normally in-person anyway; a real online
// self-serve purchase flow is a reasonable follow-up once this is proven,
// not part of the smallest production-safe version.

/**
 * Atomically claims one session from a customer's package balance — the
 * WHERE clause and the decrement happen as one statement, so two
 * concurrent redemption attempts (e.g. two staff members both booking the
 * same customer's "last session" at once) can't both succeed and drive
 * the balance negative. Same compare-and-swap shape as
 * lib/classes.ts's claimClassSeat.
 */
export async function redeemPackageSession(c: PoolClient, packagePurchaseId: string): Promise<boolean> {
  const { rows } = await c.query(
    `UPDATE package_purchases
     SET sessions_remaining = sessions_remaining - 1
     WHERE id = $1 AND status = 'active' AND sessions_remaining > 0
       AND (expires_at IS NULL OR expires_at > now())
     RETURNING id`,
    [packagePurchaseId]
  );
  return rows.length > 0;
}

/**
 * Gives a session back — called when a booking that was paid for by
 * redeeming a package gets cancelled, the same way releaseClassSeat undoes
 * claimClassSeat. Deliberately does not resurrect an 'expired'/'refunded'
 * purchase back to 'active'; it only ever restores the count on a
 * still-active one (a cancelled booking against an expired package just
 * means that session is gone either way).
 */
export async function restorePackageSession(c: PoolClient, packagePurchaseId: string): Promise<void> {
  await c.query(
    `UPDATE package_purchases
     SET sessions_remaining = sessions_remaining + 1
     WHERE id = $1 AND status = 'active'`,
    [packagePurchaseId]
  );
}

export type ActivePackage = {
  id: string;
  packageName: string;
  serviceId: string;
  serviceName: string;
  sessionsRemaining: number;
  sessionsTotal: number;
  expiresAt: string | null;
};

/** A customer's usable packages for booking right now — active, balance > 0, not expired. */
export async function listActivePackagesForCustomer(
  c: PoolClient,
  customerId: string
): Promise<ActivePackage[]> {
  const { rows } = await c.query(
    `SELECT pp.id, p.name AS package_name, p.service_id, s.name AS service_name,
            pp.sessions_remaining, pp.sessions_total, pp.expires_at
     FROM package_purchases pp
     JOIN packages p ON p.id = pp.package_id
     JOIN services s ON s.id = p.service_id
     WHERE pp.customer_id = $1 AND pp.status = 'active' AND pp.sessions_remaining > 0
       AND (pp.expires_at IS NULL OR pp.expires_at > now())
     ORDER BY pp.purchased_at DESC`,
    [customerId]
  );
  return rows.map((r) => ({
    id: r.id,
    packageName: r.package_name,
    serviceId: r.service_id,
    serviceName: r.service_name,
    sessionsRemaining: r.sessions_remaining,
    sessionsTotal: r.sessions_total,
    expiresAt: r.expires_at,
  }));
}

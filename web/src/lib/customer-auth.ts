import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminPool } from "@/db/client";
import { hashPassword, verifyPassword } from "@/lib/auth";

export { hashPassword, verifyPassword };

const SESSION_COOKIE = "velure_customer_session";
const SESSION_TTL_DAYS = 30;

export async function createCustomerSession(customerId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const { rows: [session] } = await adminPool.query(
    `INSERT INTO customer_sessions (customer_id, expires_at) VALUES ($1, $2) RETURNING id`,
    [customerId, expiresAt]
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function clearCustomerSession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await adminPool.query(`DELETE FROM customer_sessions WHERE id = $1`, [sessionId]);
  }
  cookieStore.delete(SESSION_COOKIE);
}

export type CurrentCustomer = { customerId: string; businessId: string; email: string; name: string };

export async function getCurrentCustomer(): Promise<CurrentCustomer | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const { rows: [row] } = await adminPool.query(
    `SELECT cu.id AS customer_id, cu.business_id, cu.email, cu.name
     FROM customer_sessions cs
     JOIN customers cu ON cu.id = cs.customer_id
     WHERE cs.id = $1 AND cs.expires_at > now()`,
    [sessionId]
  );
  if (!row) return null;
  return { customerId: row.customer_id, businessId: row.business_id, email: row.email, name: row.name };
}

/**
 * Customer accounts are scoped per business (see migration 017's note) —
 * a session for shop A's account means nothing on shop B's booking site,
 * so this checks the logged-in customer actually belongs to `businessId`
 * rather than just "is someone logged in." Redirects to that business's
 * own login page (not a shared one) if not.
 */
export async function requireCustomer(slug: string, businessId: string): Promise<CurrentCustomer> {
  const customer = await getCurrentCustomer();
  if (!customer || customer.businessId !== businessId) {
    redirect(`/book/${slug}/login`);
  }
  return customer;
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminPool } from "@/db/client";

// Deliberately a separate cookie from owner sessions (velure_session) —
// the platform operator and a business owner are different identities that
// can be signed in at once in the same browser (e.g. testing an owner
// account while also checking the admin dashboard).
const ADMIN_SESSION_COOKIE = "velure_admin_session";
const SESSION_TTL_DAYS = 30;

export async function createAdminSession(adminId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const { rows: [session] } = await adminPool.query(
    `INSERT INTO admin_sessions (admin_id, expires_at) VALUES ($1, $2) RETURNING id`,
    [adminId, expiresAt]
  );

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (sessionId) {
    await adminPool.query(`DELETE FROM admin_sessions WHERE id = $1`, [sessionId]);
  }
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

export type CurrentAdmin = { adminId: string; email: string };

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const { rows: [row] } = await adminPool.query(
    `SELECT a.id AS admin_id, a.email
     FROM admin_sessions s
     JOIN platform_admins a ON a.id = s.admin_id
     WHERE s.id = $1 AND s.expires_at > now()`,
    [sessionId]
  );
  if (!row) return null;
  return { adminId: row.admin_id, email: row.email };
}

/** Use at the top of any platform-admin-only page. Redirects to /admin/login if not signed in. */
export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

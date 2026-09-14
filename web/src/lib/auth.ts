import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminPool } from "@/db/client";

const scryptAsync = promisify(scrypt);
const SESSION_COOKIE = "velure_session";
const SESSION_TTL_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const stored_ = Buffer.from(hashHex, "hex");
  // Lengths can differ if `stored` is malformed — timingSafeEqual throws on
  // mismatched lengths rather than returning false, so guard first.
  if (derived.length !== stored_.length) return false;
  return timingSafeEqual(derived, stored_);
}

export async function createSession(ownerId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const { rows: [session] } = await adminPool.query(
    `INSERT INTO sessions (owner_id, expires_at) VALUES ($1, $2) RETURNING id`,
    [ownerId, expiresAt]
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

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await adminPool.query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
  }
  cookieStore.delete(SESSION_COOKIE);
}

export type AuthResult = { ok: true } | { ok: false; error: string };

export type CurrentOwner = { ownerId: string; businessId: string; email: string };

export async function getCurrentOwner(): Promise<CurrentOwner | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const { rows: [row] } = await adminPool.query(
    `SELECT o.id AS owner_id, o.business_id, o.email
     FROM sessions s
     JOIN owners o ON o.id = s.owner_id
     WHERE s.id = $1 AND s.expires_at > now()`,
    [sessionId]
  );
  if (!row) return null;
  return { ownerId: row.owner_id, businessId: row.business_id, email: row.email };
}

/** Use at the top of any owner-only page. Redirects to /login if not signed in. */
export async function requireOwner(): Promise<CurrentOwner> {
  const owner = await getCurrentOwner();
  if (!owner) redirect("/login");
  return owner;
}

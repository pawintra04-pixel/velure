import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

const COOKIE_NAME = "velure_anon";

/**
 * Not an identity — just a stable-per-browser token so createQuickHold and
 * reserveClassSeat can cap how many un-completed holds one anonymous
 * visitor can pile up (quick booking lets someone reserve a slot before
 * typing anything, which otherwise means nothing stops a visitor from
 * grabbing every remaining slot in a day). Never sent anywhere but read
 * back server-side; carries no business-scoping meaning of its own.
 */
export async function getOrCreateAnonId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (existing) return existing;

  const id = randomUUID();
  store.set(COOKIE_NAME, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 1 day — long enough to cover one booking session, short enough not to matter if it churns
    path: "/",
  });
  return id;
}

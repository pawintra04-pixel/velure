"use server";

import { redirect } from "next/navigation";
import { adminPool } from "@/db/client";
import { hashPassword, createSession, type AuthResult } from "@/lib/auth";
import { slugify } from "@/lib/slug";

export async function signUp(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const businessName = String(formData.get("businessName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!businessName || !email || !password) {
    return { ok: false, error: "All fields are required." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const { rows: existing } = await adminPool.query(`SELECT 1 FROM owners WHERE email = $1`, [
    email,
  ]);
  if (existing.length > 0) {
    return { ok: false, error: "An account with that email already exists." };
  }

  const client = await adminPool.connect();
  let ownerId: string;
  try {
    await client.query("BEGIN");
    const { rows: [business] } = await client.query(
      `INSERT INTO businesses (name, slug, timezone) VALUES ($1, $2, $3) RETURNING id`,
      [businessName, slugify(businessName), "Asia/Bangkok"]
    );
    // Default hours for a brand new business — same 09:00-19:00 every day
    // the old hardcoded stub used, editable afterward from Settings. Uses
    // adminPool (this whole signup flow runs before any session/business
    // context exists), same exception as everything else in this file.
    await client.query(
      `INSERT INTO business_hours (business_id, day_of_week, is_closed, open_time, close_time)
       SELECT $1, dow, false, '09:00', '19:00' FROM generate_series(0, 6) AS dow`,
      [business.id]
    );
    const passwordHash = await hashPassword(password);
    const { rows: [owner] } = await client.query(
      `INSERT INTO owners (business_id, email, password_hash) VALUES ($1, $2, $3) RETURNING id`,
      [business.id, email, passwordHash]
    );
    await client.query("COMMIT");
    ownerId = owner.id;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("signUp failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  } finally {
    client.release();
  }

  await createSession(ownerId);
  redirect("/dashboard");
}

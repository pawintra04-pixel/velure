"use server";

import { redirect } from "next/navigation";
import { adminPool } from "@/db/client";
import { hashPassword, createSession, type AuthResult } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { getVisitorLocale } from "@/lib/visitor-locale";
import { publicText } from "@/lib/i18n-public";

export async function signUp(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const locale = await getVisitorLocale();
  const t = publicText[locale];
  const businessName = String(formData.get("businessName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const acceptedTerms = formData.get("acceptTerms") === "on";

  if (!businessName || !email || !password) {
    return { ok: false, error: t.errAllFieldsRequired };
  }
  if (!acceptedTerms) {
    return { ok: false, error: t.errAcceptTerms };
  }
  if (password.length < 8) {
    return { ok: false, error: t.errPasswordShort };
  }

  const { rows: existing } = await adminPool.query(`SELECT 1 FROM owners WHERE email = $1`, [
    email,
  ]);
  if (existing.length > 0) {
    return { ok: false, error: t.errEmailTaken };
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
      // The dashboard starts in whatever language they signed up in.
      `INSERT INTO owners (business_id, email, password_hash, locale) VALUES ($1, $2, $3, $4) RETURNING id`,
      [business.id, email, passwordHash, locale]
    );
    await client.query("COMMIT");
    ownerId = owner.id;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("signUp failed", err);
    return { ok: false, error: t.genericError };
  } finally {
    client.release();
  }

  await createSession(ownerId);
  redirect("/dashboard");
}

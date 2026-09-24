"use server";

import { redirect } from "next/navigation";
import { adminPool } from "@/db/client";
import { getBusinessBySlug } from "@/lib/business";
import {
  hashPassword,
  verifyPassword,
  createCustomerSession,
  clearCustomerSession,
} from "@/lib/customer-auth";
import { getVisitorLocale } from "@/lib/visitor-locale";
import { publicText } from "@/lib/i18n-public";

export type AuthResult = { ok: true } | { ok: false; error: string };

export async function customerLogIn(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const t = publicText[await getVisitorLocale()];
  const slug = String(formData.get("slug") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const business = await getBusinessBySlug(slug);
  if (!business || !email || !password) {
    return { ok: false, error: t.errEmailPasswordRequired };
  }

  const { rows: [customer] } = await adminPool.query(
    `SELECT id, password_hash FROM customers WHERE business_id = $1 AND email = $2`,
    [business.id, email]
  );
  // Deliberately identical error for "no such email," "no account set up
  // yet" (password_hash is null for a quick-booking-only customer), and
  // "wrong password" — distinguishing them lets an attacker enumerate
  // which emails have booked here.
  if (!customer || !customer.password_hash || !(await verifyPassword(password, customer.password_hash))) {
    return { ok: false, error: t.errInvalidLogin };
  }

  await createCustomerSession(customer.id);
  redirect(`/book/${slug}/account`);
}

export async function customerSignUp(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const t = publicText[await getVisitorLocale()];
  const slug = String(formData.get("slug") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const business = await getBusinessBySlug(slug);
  if (!business || !name || !email || !password) {
    return { ok: false, error: t.errNameEmailPasswordRequired };
  }
  if (password.length < 8) {
    return { ok: false, error: t.errPasswordShort };
  }

  const { rows: [existing] } = await adminPool.query(
    `SELECT id, password_hash FROM customers WHERE business_id = $1 AND email = $2`,
    [business.id, email]
  );
  if (existing?.password_hash) {
    return { ok: false, error: t.errEmailTakenLogIn };
  }

  const passwordHash = await hashPassword(password);
  let customerId: string;
  try {
    if (existing) {
      // A quick-booking customer with no account yet — claim the existing
      // record (it already has real booking history) rather than create a
      // second, disconnected one.
      await adminPool.query(
        `UPDATE customers SET password_hash = $1, name = $2, phone = COALESCE(phone, $3) WHERE id = $4`,
        [passwordHash, name, phone || null, existing.id]
      );
      customerId = existing.id;
    } else {
      const { rows: [created] } = await adminPool.query(
        `INSERT INTO customers (business_id, name, phone, email, password_hash)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [business.id, name, phone || null, email, passwordHash]
      );
      customerId = created.id;
    }
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return { ok: false, error: t.errPhoneOnFile };
    }
    console.error("customerSignUp failed", err);
    return { ok: false, error: t.genericError };
  }

  await createCustomerSession(customerId);
  redirect(`/book/${slug}/account`);
}

export async function customerLogOut(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  await clearCustomerSession();
  redirect(`/book/${slug}`);
}

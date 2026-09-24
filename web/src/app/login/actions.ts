"use server";

import { redirect } from "next/navigation";
import { adminPool } from "@/db/client";
import { getVisitorLocale } from "@/lib/visitor-locale";
import { publicText } from "@/lib/i18n-public";
import { verifyPassword, createSession, clearSession, type AuthResult } from "@/lib/auth";

export async function logIn(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const t = publicText[await getVisitorLocale()];
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: t.errEmailPasswordRequired };
  }

  const { rows: [owner] } = await adminPool.query(
    `SELECT id, password_hash FROM owners WHERE email = $1`,
    [email]
  );
  // Deliberately identical error for "no such email" and "wrong password" —
  // distinguishing them lets an attacker enumerate registered emails.
  if (!owner || !(await verifyPassword(password, owner.password_hash))) {
    return { ok: false, error: t.errInvalidLogin };
  }

  await createSession(owner.id);
  redirect("/dashboard");
}

export async function logOut(): Promise<void> {
  await clearSession();
  redirect("/login");
}

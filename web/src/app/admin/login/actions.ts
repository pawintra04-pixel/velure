"use server";

import { redirect } from "next/navigation";
import { adminPool } from "@/db/client";
import { verifyPassword } from "@/lib/auth";
import { createAdminSession, clearAdminSession } from "@/lib/admin-auth";
import type { AuthResult } from "@/lib/auth";

export async function adminLogIn(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  const { rows: [admin] } = await adminPool.query(
    `SELECT id, password_hash FROM platform_admins WHERE email = $1`,
    [email]
  );
  // Deliberately identical error for "no such email" and "wrong password" —
  // same reasoning as the owner login (see login/actions.ts).
  if (!admin || !(await verifyPassword(password, admin.password_hash))) {
    return { ok: false, error: "Invalid email or password." };
  }

  await createAdminSession(admin.id);
  redirect("/admin");
}

export async function adminLogOut(): Promise<void> {
  await clearAdminSession();
  redirect("/admin/login");
}

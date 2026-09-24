"use client";

import { useActionState } from "react";
import Link from "next/link";
import { logIn } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(logIn, null);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">เข้าสู่ระบบ</h1>
      <p className="mt-1 text-sm text-ink-secondary">ยินดีต้อนรับกลับสู่ Velure</p>

      <form action={formAction} className="mt-6 flex flex-col gap-3">
        <input
          name="email"
          type="email"
          placeholder="อีเมล"
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <input
          name="password"
          type="password"
          placeholder="รหัสผ่าน"
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-ink disabled:opacity-50"
        >
          {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-ink-muted">
        ยังไม่มีบัญชี?{" "}
        <Link href="/signup" className="text-accent underline">
          สมัครใช้งาน
        </Link>
      </p>
    </div>
  );
}

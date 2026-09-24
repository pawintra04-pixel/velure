"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "./actions";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signUp, null);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">สมัครใช้งานสำหรับร้านค้า</h1>
      <p className="mt-1 text-sm text-ink-secondary">เริ่มรับจองคิวได้ในไม่กี่นาที</p>

      <form action={formAction} className="mt-6 flex flex-col gap-3">
        <input
          name="businessName"
          placeholder="ชื่อร้าน"
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <input
          name="email"
          type="email"
          placeholder="อีเมล"
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <input
          name="password"
          type="password"
          placeholder="รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)"
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <label className="flex items-start gap-2 text-sm text-ink-secondary">
          <input type="checkbox" name="acceptTerms" required className="mt-1" />
          <span>
            ฉันยอมรับ{" "}
            <Link href="/terms" target="_blank" className="text-accent underline">
              ข้อกำหนดการใช้งาน
            </Link>{" "}
            และ{" "}
            <Link href="/privacy" target="_blank" className="text-accent underline">
              นโยบายความเป็นส่วนตัว
            </Link>
          </span>
        </label>
        {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-ink disabled:opacity-50"
        >
          {pending ? "กำลังสร้างบัญชี..." : "สร้างบัญชี"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-ink-muted">
        มีบัญชีอยู่แล้ว?{" "}
        <Link href="/login" className="text-accent underline">
          เข้าสู่ระบบ
        </Link>
      </p>
    </div>
  );
}

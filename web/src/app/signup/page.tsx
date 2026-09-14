"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "./actions";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signUp, null);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Create your business</h1>
      <p className="mt-1 text-sm text-ink-secondary">Start taking bookings in minutes.</p>

      <form action={formAction} className="mt-6 flex flex-col gap-3">
        <input
          name="businessName"
          placeholder="Business name"
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <input
          name="password"
          type="password"
          placeholder="Password (min. 8 characters)"
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-ink disabled:opacity-50"
        >
          {pending ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

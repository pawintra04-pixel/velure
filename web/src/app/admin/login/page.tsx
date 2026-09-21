"use client";

import { useActionState } from "react";
import { adminLogIn } from "./actions";

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(adminLogIn, null);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Platform admin</h1>
      <p className="mt-1 text-sm text-ink-secondary">Not the owner dashboard — that&apos;s at /login.</p>

      <form action={formAction} className="mt-6 flex flex-col gap-3">
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-ink disabled:opacity-50"
        >
          {pending ? "Logging in..." : "Log in"}
        </button>
      </form>
    </div>
  );
}

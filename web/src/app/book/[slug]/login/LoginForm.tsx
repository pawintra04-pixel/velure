"use client";

import { useActionState } from "react";
import { customerLogIn, type AuthResult } from "../customer-auth-actions";

export function LoginForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState<AuthResult | null, FormData>(customerLogIn, null);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input name="email" type="email" placeholder="Email" className="rounded-lg border border-border px-4 py-3 text-sm" />
      <input
        name="password"
        type="password"
        placeholder="Password"
        className="rounded-lg border border-border px-4 py-3 text-sm"
      />
      {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-accent py-3 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}

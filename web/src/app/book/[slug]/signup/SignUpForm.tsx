"use client";

import { useActionState } from "react";
import { customerSignUp, type AuthResult } from "../customer-auth-actions";

export function SignUpForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState<AuthResult | null, FormData>(customerSignUp, null);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input name="name" placeholder="Name" className="rounded-lg border border-border px-4 py-3 text-sm" />
      <input name="phone" placeholder="Phone number" className="rounded-lg border border-border px-4 py-3 text-sm" />
      <input name="email" type="email" placeholder="Email" className="rounded-lg border border-border px-4 py-3 text-sm" />
      <input
        name="password"
        type="password"
        placeholder="Password (min. 8 characters)"
        className="rounded-lg border border-border px-4 py-3 text-sm"
      />
      {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-sunburst py-3 text-sm font-medium text-ink disabled:opacity-50"
      >
        {pending ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}

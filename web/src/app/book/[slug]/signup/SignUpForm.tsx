"use client";

import { useActionState } from "react";
import { customerSignUp, type AuthResult } from "../customer-auth-actions";
import type { Locale } from "@/lib/i18n";
import { publicText } from "@/lib/i18n-public";

export function SignUpForm({ slug, locale }: { slug: string; locale: Locale }) {
  const t = publicText[locale];
  const [state, formAction, pending] = useActionState<AuthResult | null, FormData>(customerSignUp, null);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input name="name" placeholder={t.name} className="rounded-lg border border-border px-4 py-3 text-sm" />
      <input name="phone" placeholder={t.phoneNumber} className="rounded-lg border border-border px-4 py-3 text-sm" />
      <input name="email" type="email" placeholder={t.email} className="rounded-lg border border-border px-4 py-3 text-sm" />
      <input
        name="password"
        type="password"
        placeholder={t.passwordMin}
        className="rounded-lg border border-border px-4 py-3 text-sm"
      />
      {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-sunburst py-3 text-sm font-medium text-ink disabled:opacity-50"
      >
        {pending ? t.creatingAccount : t.createAccount}
      </button>
    </form>
  );
}

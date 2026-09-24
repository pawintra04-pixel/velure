"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "./actions";
import type { Locale } from "@/lib/i18n";
import { publicText } from "@/lib/i18n-public";

export function SignupForm({ locale }: { locale: Locale }) {
  const t = publicText[locale];
  const [state, formAction, pending] = useActionState(signUp, null);

  return (
    <>
      <h1 className="text-2xl font-semibold">{t.ownerSignupTitle}</h1>
      <p className="mt-1 text-sm text-ink-secondary">{t.ownerSignupSubtitle}</p>

      <form action={formAction} className="mt-6 flex flex-col gap-3">
        <input
          name="businessName"
          placeholder={t.businessName}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <input
          name="email"
          type="email"
          placeholder={t.email}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <input
          name="password"
          type="password"
          placeholder={t.passwordMin}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <label className="flex items-start gap-2 text-sm text-ink-secondary">
          <input type="checkbox" name="acceptTerms" required className="mt-1" />
          <span>
            {t.acceptTermsPrefix}{" "}
            <Link href="/terms" target="_blank" className="text-accent underline">
              {t.terms}
            </Link>{" "}
            {t.and}{" "}
            <Link href="/privacy" target="_blank" className="text-accent underline">
              {t.privacy}
            </Link>
          </span>
        </label>
        {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-ink disabled:opacity-50"
        >
          {pending ? t.creatingAccount : t.createAccount}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-ink-muted">
        {t.haveAccount}{" "}
        <Link href="/login" className="text-accent underline">
          {t.logIn}
        </Link>
      </p>
    </>
  );
}

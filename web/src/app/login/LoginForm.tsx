"use client";

import { useActionState } from "react";
import Link from "next/link";
import { logIn } from "./actions";
import type { Locale } from "@/lib/i18n";
import { publicText } from "@/lib/i18n-public";

export function LoginForm({ locale }: { locale: Locale }) {
  const t = publicText[locale];
  const [state, formAction, pending] = useActionState(logIn, null);

  return (
    <>
      <h1 className="text-2xl font-semibold">{t.logIn}</h1>
      <p className="mt-1 text-sm text-ink-secondary">{t.ownerLoginSubtitle}</p>

      <form action={formAction} className="mt-6 flex flex-col gap-3">
        <input
          name="email"
          type="email"
          placeholder={t.email}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <input
          name="password"
          type="password"
          placeholder={t.password}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-ink disabled:opacity-50"
        >
          {pending ? t.loggingIn : t.logIn}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-ink-muted">
        {t.noAccount}{" "}
        <Link href="/signup" className="text-accent underline">
          {t.createOne}
        </Link>
      </p>
    </>
  );
}

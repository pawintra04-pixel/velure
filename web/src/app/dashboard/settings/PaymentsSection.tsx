"use client";

import { useActionState } from "react";
import { connectStripeAccount } from "./stripe-actions";
import { updatePaymentMethods, updateCancellationPolicy, type ActionResult } from "./actions";
import { paymentsSettingsText, type Locale } from "@/lib/i18n";

export function PaymentsSection({
  hasAccount,
  chargesEnabled,
  acceptsCard,
  acceptsPromptpay,
  acceptsCash,
  cancelCutoffHours,
  rescheduleCutoffHours,
  locale,
}: {
  hasAccount: boolean;
  chargesEnabled: boolean;
  acceptsCard: boolean;
  acceptsPromptpay: boolean;
  acceptsCash: boolean;
  cancelCutoffHours: number;
  rescheduleCutoffHours: number;
  locale: Locale;
}) {
  const t = paymentsSettingsText[locale];
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updatePaymentMethods,
    null
  );
  const [policyState, policyAction, policyPending] = useActionState<ActionResult | null, FormData>(
    updateCancellationPolicy,
    null
  );

  return (
    <div className="flex max-w-xl flex-col gap-3">
      <div className="text-sm font-medium text-ink-secondary">{t.stripeHeading}</div>

      {!hasAccount && (
        <>
          <p className="text-sm text-ink-muted">{t.connectIntro}</p>
          <form action={connectStripeAccount}>
            <button
              type="submit"
              className="self-start rounded-xl bg-sunburst px-4 py-2.5 text-sm font-medium text-ink"
            >
              {t.connectStripe}
            </button>
          </form>
        </>
      )}

      {hasAccount && chargesEnabled && (
        <div className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full bg-[#0ca30c]" />
          {t.connectedReady}
        </div>
      )}

      {hasAccount && !chargesEnabled && (
        <>
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-[#a8681c]" />
            {t.connectedIncomplete}
          </div>
          <form action={connectStripeAccount}>
            <button
              type="submit"
              className="self-start rounded-xl bg-sunburst px-4 py-2.5 text-sm font-medium text-ink"
            >
              {t.finishSetup}
            </button>
          </form>
        </>
      )}

      <div className="mt-3 border-t border-border pt-4">
        <div className="text-sm font-medium text-ink-secondary">{t.waysToPay}</div>
        <form action={formAction} className="mt-3 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="acceptsCard" defaultChecked={acceptsCard} />
            {t.card}
            {!hasAccount && <span className="text-xs text-ink-muted">{t.needsStripe}</span>}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="acceptsPromptpay" defaultChecked={acceptsPromptpay} />
            {t.promptpay}
            {!hasAccount && <span className="text-xs text-ink-muted">{t.needsStripe}</span>}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="acceptsCash" defaultChecked={acceptsCash} />
            {t.cash}
          </label>
          {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}
          <button
            type="submit"
            disabled={pending}
            className="mt-1 self-start rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-page disabled:opacity-50"
          >
            {pending ? t.saving : t.save}
          </button>
        </form>
      </div>

      <div className="mt-3 border-t border-border pt-4">
        <div className="text-sm font-medium text-ink-secondary">{t.policyHeading}</div>
        <p className="mt-1 text-sm text-ink-muted">{t.policyIntro}</p>
        <form action={policyAction} className="mt-3 flex flex-col gap-3">
          <label className="text-sm text-ink-secondary">
            {t.rescheduleCutoffLabel}
            <input
              name="rescheduleCutoffHours"
              type="number"
              min={0}
              max={720}
              step={1}
              defaultValue={rescheduleCutoffHours}
              className="mt-1 w-full max-w-[160px] rounded-lg border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-ink-secondary">
            {t.cancelCutoffLabel}
            <input
              name="cancelCutoffHours"
              type="number"
              min={0}
              max={720}
              step={1}
              defaultValue={cancelCutoffHours}
              className="mt-1 w-full max-w-[160px] rounded-lg border border-border px-3 py-2 text-sm"
            />
          </label>
          {policyState && !policyState.ok && <div className="text-sm text-[#d03b3b]">{policyState.error}</div>}
          <button
            type="submit"
            disabled={policyPending}
            className="self-start rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-page disabled:opacity-50"
          >
            {policyPending ? t.savingPolicy : t.savePolicy}
          </button>
        </form>
      </div>
    </div>
  );
}

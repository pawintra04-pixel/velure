"use client";

import { useActionState } from "react";
import { connectStripeAccount } from "./stripe-actions";
import { updatePaymentMethods, type ActionResult } from "./actions";

export function PaymentsSection({
  hasAccount,
  chargesEnabled,
  acceptsCard,
  acceptsPromptpay,
  acceptsCash,
}: {
  hasAccount: boolean;
  chargesEnabled: boolean;
  acceptsCard: boolean;
  acceptsPromptpay: boolean;
  acceptsCash: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updatePaymentMethods,
    null
  );

  return (
    <div className="flex max-w-xl flex-col gap-3">
      <div className="text-sm font-medium text-ink-secondary">Stripe</div>

      {!hasAccount && (
        <>
          <p className="text-sm text-ink-muted">
            Connect a Stripe account to accept PromptPay and card payments — money goes straight
            to your own account, Velure never holds it.
          </p>
          <form action={connectStripeAccount}>
            <button
              type="submit"
              className="self-start rounded-xl bg-sunburst px-4 py-2.5 text-sm font-medium text-ink"
            >
              Connect Stripe
            </button>
          </form>
        </>
      )}

      {hasAccount && chargesEnabled && (
        <div className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full bg-[#0ca30c]" />
          Connected — ready to accept payments.
        </div>
      )}

      {hasAccount && !chargesEnabled && (
        <>
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-[#a8681c]" />
            Connected but incomplete — Stripe needs a bit more information before you can
            accept payments.
          </div>
          <form action={connectStripeAccount}>
            <button
              type="submit"
              className="self-start rounded-xl bg-sunburst px-4 py-2.5 text-sm font-medium text-ink"
            >
              Finish setup
            </button>
          </form>
        </>
      )}

      <div className="mt-3 border-t border-border pt-4">
        <div className="text-sm font-medium text-ink-secondary">Ways customers can pay</div>
        <form action={formAction} className="mt-3 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="acceptsCard" defaultChecked={acceptsCard} />
            Card
            {!hasAccount && <span className="text-xs text-ink-muted">(needs Stripe connected above)</span>}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="acceptsPromptpay" defaultChecked={acceptsPromptpay} />
            PromptPay
            {!hasAccount && <span className="text-xs text-ink-muted">(needs Stripe connected above)</span>}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="acceptsCash" defaultChecked={acceptsCash} />
            Cash (pay in person)
          </label>
          {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}
          <button
            type="submit"
            disabled={pending}
            className="mt-1 self-start rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-page disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}

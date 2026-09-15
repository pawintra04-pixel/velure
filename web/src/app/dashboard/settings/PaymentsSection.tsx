import { connectStripeAccount } from "./stripe-actions";

export function PaymentsSection({
  hasAccount,
  chargesEnabled,
}: {
  hasAccount: boolean;
  chargesEnabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6">
      <div className="text-sm font-medium text-ink-secondary">Payments</div>

      {!hasAccount && (
        <>
          <p className="text-sm text-ink-muted">
            Connect a Stripe account to accept PromptPay and card payments — money goes straight
            to your own account, Velure never holds it.
          </p>
          <form action={connectStripeAccount}>
            <button
              type="submit"
              className="self-start rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink"
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
            <span className="h-2 w-2 rounded-full bg-[#fab219]" />
            Connected, but Stripe still needs a bit more information before you can accept
            payments.
          </div>
          <form action={connectStripeAccount}>
            <button
              type="submit"
              className="self-start rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-page"
            >
              Finish setup on Stripe
            </button>
          </form>
        </>
      )}
    </div>
  );
}

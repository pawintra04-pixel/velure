"use server";

import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { stripe } from "@/lib/stripe";

/**
 * Standard Connect accounts, created directly via the API (not OAuth) —
 * proven in spikes/stripe-connect-promptpay/create-merchant.ts. TH
 * platforms can't use Express/Custom ("platform is loss-liable, due to
 * risk control measures" — a real error hit running that spike), and
 * Standard also fits "money goes straight to the shop" better anyway: the
 * shop owns its own Stripe identity outright, Velure never touches funds.
 *
 * Before this, only the seeded demo business had a stripe_account_id,
 * attached once by hand through the same spike's onboarding link — a real
 * signed-up business had no way to get one at all. This is that self-serve
 * path.
 */
export async function connectStripeAccount(): Promise<void> {
  const owner = await requireOwner();

  const { rows: [business] } = await withBusinessContext(owner.businessId, (c) =>
    c.query<{ stripe_account_id: string | null }>(`SELECT stripe_account_id FROM businesses WHERE id = $1`, [
      owner.businessId,
    ])
  );

  let accountId = business.stripe_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "standard",
      country: "TH",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
        promptpay_payments: { requested: true },
      },
    });
    accountId = account.id;
    await withBusinessContext(owner.businessId, (c) =>
      c.query(`UPDATE businesses SET stripe_account_id = $1 WHERE id = $2`, [accountId, owner.businessId])
    );
  }

  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/dashboard/settings`,
    return_url: `${baseUrl}/dashboard/settings`,
    type: "account_onboarding",
  });

  redirect(accountLink.url);
}

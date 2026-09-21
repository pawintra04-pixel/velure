import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { stripe } from "@/lib/stripe";
import { ProfileForm } from "./ProfileForm";
import { HoursForm } from "./HoursForm";
import { PaymentsSection } from "./PaymentsSection";
import { WhatsAppSection } from "./WhatsAppSection";
import { SettingsTabs, SETTINGS_SECTIONS, type SettingsSectionKey } from "./SettingsTabs";
import { PageShell, PageHeader, Surface, ReadableSection } from "@/components/dashboard/PageShell";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const owner = await requireOwner();
  const { section: sectionParam } = await searchParams;
  const section: SettingsSectionKey = SETTINGS_SECTIONS.some((s) => s.key === sectionParam)
    ? (sectionParam as SettingsSectionKey)
    : "business";

  const { business, hours } = await withBusinessContext(owner.businessId, async (c) => {
    const { rows: [business] } = await c.query(
      `SELECT name, business_type, logo_url, description, address, contact_phone, contact_email,
              stripe_account_id, accepts_card, accepts_promptpay, accepts_cash, whatsapp_phone_number_id
       FROM businesses WHERE id = $1`,
      [owner.businessId]
    );
    const { rows: hours } = await c.query(
      `SELECT day_of_week, is_closed, open_time, close_time
       FROM business_hours WHERE business_id = $1 ORDER BY day_of_week`,
      [owner.businessId]
    );
    return { business, hours };
  });

  // Live status, not cached — an owner finishing Stripe's hosted onboarding
  // flow and landing back here should see it reflected immediately, and
  // this is the only place that reads it, so a live call is cheap enough.
  const chargesEnabled = business.stripe_account_id
    ? (await stripe.accounts.retrieve(business.stripe_account_id)).charges_enabled
    : false;

  return (
    <PageShell width="standard">
      <div className="border-b border-border pb-5">
        <PageHeader
          title="Settings"
          description="Your business profile, hours, and payments — shown to customers on your public booking page and used to keep bookings inside real operating hours."
        />
        <div className="mt-5">
          <SettingsTabs active={section} />
        </div>
      </div>

      <div className="mt-6">
        <ReadableSection>
          <Surface>
            {section === "business" && <ProfileForm business={business} />}
            {section === "hours" && <HoursForm hours={hours} />}
            {section === "payments" && (
              <PaymentsSection
                hasAccount={Boolean(business.stripe_account_id)}
                chargesEnabled={chargesEnabled}
                acceptsCard={business.accepts_card}
                acceptsPromptpay={business.accepts_promptpay}
                acceptsCash={business.accepts_cash}
              />
            )}
            {section === "whatsapp" && (
              <WhatsAppSection connected={Boolean(business.whatsapp_phone_number_id)} />
            )}
          </Surface>
        </ReadableSection>
      </div>
    </PageShell>
  );
}

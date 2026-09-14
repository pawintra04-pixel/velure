import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { ProfileForm } from "./ProfileForm";
import { HoursForm } from "./HoursForm";

export default async function SettingsPage() {
  const owner = await requireOwner();

  const { business, hours } = await withBusinessContext(owner.businessId, async (c) => {
    const { rows: [business] } = await c.query(
      `SELECT name, business_type, logo_url, description, address, contact_phone, contact_email
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

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Your business profile and opening hours — shown to customers on your public booking page
        and used to keep bookings inside real operating hours.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        <ProfileForm business={business} />
        <HoursForm hours={hours} />
      </div>
    </div>
  );
}

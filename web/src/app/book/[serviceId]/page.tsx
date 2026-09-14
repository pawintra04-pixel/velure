import { notFound } from "next/navigation";
import { getDemoBusinessId } from "@/lib/demo-business";
import { withBusinessContext } from "@/db/client";
import { getAvailableSlots } from "@/lib/availability";
import { BookingWizard } from "./BookingWizard";

function todayISOInBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

export default async function ServiceBookingPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;
  const businessId = await getDemoBusinessId();

  const service = await withBusinessContext(businessId, async (c) => {
    const { rows: [row] } = await c.query(
      `SELECT id, name, duration_minutes, price_amount, currency, payment_mode, deposit_amount
       FROM services WHERE id = $1`,
      [serviceId]
    );
    return row ?? null;
  });

  if (!service) notFound();

  const today = todayISOInBangkok();
  const initialSlots = await getAvailableSlots(businessId, serviceId, today);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold">{service.name}</h1>
      <p className="mt-1 text-sm text-ink-secondary">{service.duration_minutes} min</p>

      <BookingWizard
        businessId={businessId}
        serviceId={serviceId}
        initialDate={today}
        initialSlots={initialSlots}
      />
    </div>
  );
}

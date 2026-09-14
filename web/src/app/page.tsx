import { redirect } from "next/navigation";

// Temporary: the real "/" will be the marketing/booking-embed surface once
// those exist (docs/ARCHITECTURE.md's Booking Engine). Until then, land
// straight on the owner dashboard.
export default function Home() {
  redirect("/dashboard");
}

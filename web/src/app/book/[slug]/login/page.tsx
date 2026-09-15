import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/business";
import { BookingHeader } from "@/components/booking/BookingHeader";
import { LoginForm } from "./LoginForm";

export default async function CustomerLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  return (
    <>
      <BookingHeader businessName={business.name} slug={slug} businessId={business.id} logoUrl={business.logo_url} />
      <div className="mx-auto flex max-w-sm flex-col px-6 py-16">
        <h1 className="text-2xl font-semibold">Log in</h1>
        <p className="mt-1 text-sm text-ink-secondary">See and manage your bookings with {business.name}.</p>

        <LoginForm slug={slug} />

        <p className="mt-4 text-center text-sm text-ink-muted">
          Don&apos;t have an account?{" "}
          <Link href={`/book/${slug}/signup`} className="text-accent underline">
            Create one
          </Link>
        </p>
      </div>
    </>
  );
}

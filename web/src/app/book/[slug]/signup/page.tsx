import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/business";
import { BookingHeader } from "@/components/booking/BookingHeader";
import { SignUpForm } from "./SignUpForm";

export default async function CustomerSignUpPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  return (
    <>
      <BookingHeader businessName={business.name} slug={slug} businessId={business.id} logoUrl={business.logo_url} />
      <div className="mx-auto flex max-w-sm flex-col px-6 py-16">
        <h1 className="text-2xl font-semibold">Create an account</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          See all your bookings with {business.name} in one place, and manage them without hunting
          for the email link each time.
        </p>

        <SignUpForm slug={slug} />

        <p className="mt-4 text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link href={`/book/${slug}/login`} className="text-accent underline">
            Log in
          </Link>
        </p>
      </div>
    </>
  );
}

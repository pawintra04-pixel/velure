import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/business";
import { BookingHeader } from "@/components/booking/BookingHeader";
import { SignUpForm } from "./SignUpForm";
import { getVisitorLocale } from "@/lib/visitor-locale";
import { publicText, tCustomerSignupSubtitle } from "@/lib/i18n-public";

export default async function CustomerSignUpPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();
  const locale = await getVisitorLocale();
  const t = publicText[locale];

  return (
    <>
      <BookingHeader businessName={business.name} slug={slug} businessId={business.id} logoUrl={business.logo_url} />
      <div className="mx-auto flex max-w-sm flex-col px-6 py-16">
        <h1 className="text-2xl font-semibold">{t.createAccountTitle}</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          {tCustomerSignupSubtitle(locale, business.name)}
        </p>

        <SignUpForm slug={slug} locale={locale} />

        <p className="mt-4 text-center text-sm text-ink-muted">
          {t.haveAccount}{" "}
          <Link href={`/book/${slug}/login`} className="text-accent underline">
            {t.logIn}
          </Link>
        </p>
      </div>
    </>
  );
}

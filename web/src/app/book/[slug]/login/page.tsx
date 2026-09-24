import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/business";
import { BookingHeader } from "@/components/booking/BookingHeader";
import { LoginForm } from "./LoginForm";
import { getVisitorLocale } from "@/lib/visitor-locale";
import { publicText, tCustomerLoginSubtitle } from "@/lib/i18n-public";

export default async function CustomerLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();
  const locale = await getVisitorLocale();
  const t = publicText[locale];

  return (
    <>
      <BookingHeader businessName={business.name} slug={slug} businessId={business.id} logoUrl={business.logo_url} />
      <div className="mx-auto flex max-w-sm flex-col px-6 py-16">
        <h1 className="text-2xl font-semibold">{t.customerLoginTitle}</h1>
        <p className="mt-1 text-sm text-ink-secondary">{tCustomerLoginSubtitle(locale, business.name)}</p>

        <LoginForm slug={slug} locale={locale} />

        <p className="mt-4 text-center text-sm text-ink-muted">
          {t.noAccount}{" "}
          <Link href={`/book/${slug}/signup`} className="text-accent underline">
            {t.createOne}
          </Link>
        </p>
      </div>
    </>
  );
}

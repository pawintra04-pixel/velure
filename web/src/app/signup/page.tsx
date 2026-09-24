import { getVisitorLocale } from "@/lib/visitor-locale";
import { LocaleSwitch } from "@/components/locale/LocaleSwitch";
import { SignupForm } from "./SignupForm";

export default async function Page() {
  const locale = await getVisitorLocale();
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <LocaleSwitch locale={locale} className="mb-8 self-end" />
      <SignupForm locale={locale} />
    </div>
  );
}

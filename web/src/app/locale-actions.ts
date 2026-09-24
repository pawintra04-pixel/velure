"use server";

import { resolveLocale } from "@/lib/i18n";
import { writeVisitorLocale } from "@/lib/visitor-locale";

// Setting a cookie inside a server action makes Next re-render the current
// route with it, so the page switches language without a manual refresh.
export async function setVisitorLocale(formData: FormData): Promise<void> {
  await writeVisitorLocale(resolveLocale(String(formData.get("locale") ?? "")));
}

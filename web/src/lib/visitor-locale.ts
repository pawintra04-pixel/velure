import { cookies } from "next/headers";
import { resolveLocale, type Locale } from "@/lib/i18n";

// Language for anyone not (yet) inside the owner dashboard — booking
// customers, and owners on the login/signup screens. Stored in a cookie
// because these visitors have no account row to hold a preference.
// English by default: many pilot shops serve foreign tourists (see
// 028_owner_locale.sql), and anyone can switch with the EN / ไทย toggle.
export const LOCALE_COOKIE = "velure_locale";

export async function getVisitorLocale(): Promise<Locale> {
  const store = await cookies();
  return resolveLocale(store.get(LOCALE_COOKIE)?.value ?? "en");
}

export async function writeVisitorLocale(locale: Locale): Promise<void> {
  const store = await cookies();
  const production = process.env.NODE_ENV === "production";
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    // SameSite=None so the choice also sticks inside the embed widget
    // (an iframe on the shop's own site is a third-party context).
    sameSite: production ? "none" : "lax",
    secure: production,
  });
}

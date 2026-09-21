"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logOut } from "@/app/login/actions";
import { navLabels, type Locale } from "@/lib/i18n";

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4.5 w-4.5 shrink-0">
      <path d={path} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV_ITEMS = [
  {
    labelKey: "overview",
    href: "/dashboard",
    icon: "M3 10.5 10 4l7 6.5M5 9v7h10V9",
  },
  {
    labelKey: "bookings",
    href: "/dashboard/bookings",
    icon: "M4 4h12v13H4V4Zm0 4h12M7 2v3M13 2v3",
  },
  {
    labelKey: "calendar",
    href: "/dashboard/calendar",
    icon: "M4 4h12v13H4V4Zm0 4h12M7 2v3M13 2v3M7 11h2M11 11h2M7 14h2",
  },
  {
    labelKey: "customers",
    href: "/dashboard/customers",
    icon: "M7 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm0 1.5c-3 0-5.5 1.8-5.5 4.5v1h11v-1c0-2.7-2.5-4.5-5.5-4.5ZM13.5 5a2 2 0 1 1 0 4M14 10c1.8.4 3 1.6 3 3.3V15h-2.5",
  },
  {
    labelKey: "services",
    href: "/dashboard/services",
    icon: "M4 4h6l6 6-6 6-6-6V4Zm3 3h.01",
  },
  {
    labelKey: "team",
    href: "/dashboard/staff",
    icon: "M7 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm7 1a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM2.5 16c.5-3 2-5 4.5-5s4 2 4.5 5M12.5 12c2 0 3.5 1.7 4 4",
  },
  {
    labelKey: "classes",
    href: "/dashboard/classes",
    icon: "M4 6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Zm3 3.5h6M7 12.5h4",
    setupKey: "classesConfigured" as const,
  },
  {
    // labelKey only — the route/page underneath is still "Studios" (its
    // own, separately-scoped rename, deferred past this Overview-only
    // phase).
    labelKey: "resources",
    href: "/dashboard/studios",
    icon: "M3 17V7l7-4 7 4v10M3 17h14M3 17v-6h4v6M13 17v-6h4v6M8.5 9.5h3",
    setupKey: "resourcesConfigured" as const,
  },
  {
    labelKey: "share",
    href: "/dashboard/share",
    icon: "M14 6.5a2 2 0 1 0-1.9-2.7L7.8 6.4a2 2 0 1 0 0 3.2l4.3 2.6a2 2 0 1 0 .7-1.3L8.5 8.3a2 2 0 0 0 0-.6l4.3-2.6c.35.28.77.4 1.2.4Z",
  },
  {
    labelKey: "reports",
    href: "/dashboard/reports",
    icon: "M4 16V9m4.5 7V4m4.5 12v-5m4.5 5V7",
  },
  {
    labelKey: "settings",
    href: "/dashboard/settings",
    icon: "M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm7-2.5a7 7 0 0 1-.1 1.2l1.5 1.2-1.5 2.6-1.8-.6a7 7 0 0 1-2 1.2L12.7 17H7.3l-.4-1.9a7 7 0 0 1-2-1.2l-1.8.6-1.5-2.6L3.1 10.7A7 7 0 0 1 3 10c0-.4 0-.8.1-1.2L1.6 7.6l1.5-2.6 1.8.6a7 7 0 0 1 2-1.2L7.3 3h5.4l.4 1.9a7 7 0 0 1 2 1.2l1.8-.6 1.5 2.6-1.5 1.1c.1.4.1.8.1 1.2Z",
  },
];

type NavSetupFlags = { classesConfigured: boolean; resourcesConfigured: boolean };

function NavLinks({ pathname, setup, locale }: { pathname: string; setup: NavSetupFlags; locale: Locale }) {
  const labels = navLabels[locale];
  return (
    <nav className="mt-8 flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        const needsSetup = item.setupKey ? !setup[item.setupKey] : false;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm transition-colors ${
              active
                ? "bg-midnight-active-bg text-sunburst"
                : "text-midnight-ink-muted hover:bg-midnight-active-bg hover:text-midnight-ink"
            }`}
          >
            {active && (
              <span className="absolute left-[-8px] top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-sunburst" />
            )}
            <Icon path={item.icon} />
            {labels[item.labelKey]}
            {needsSetup && (
              <span className="ml-auto text-[10px] tracking-wide text-white/30">{labels.setUp}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function AccountFooter({ ownerEmail, locale }: { ownerEmail: string; locale: Locale }) {
  return (
    <div className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-4">
      <div className="truncate px-2 text-xs text-midnight-ink-muted">{ownerEmail}</div>
      <form action={logOut}>
        <button
          type="submit"
          className="w-full rounded-lg px-4 py-2 text-left text-sm text-midnight-ink-muted hover:bg-midnight-active-bg hover:text-midnight-ink"
        >
          {navLabels[locale].logOut}
        </button>
      </form>
    </div>
  );
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sunburst">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
          <path d="M4 10.5 8 14.5 16 6" stroke="#252C37" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      Velure
    </span>
  );
}

export function Sidebar({
  ownerEmail,
  classesConfigured,
  resourcesConfigured,
  locale,
}: {
  ownerEmail: string;
  classesConfigured: boolean;
  resourcesConfigured: boolean;
  locale: Locale;
}) {
  const pathname = usePathname();
  const setup: NavSetupFlags = { classesConfigured, resourcesConfigured };
  const [open, setOpen] = useState(false);

  // A fixed w-56 sidebar left no usable width for content on a phone —
  // most owners running a small shop will manage it from one, not a
  // desktop. Below `lg`, it collapses to a slim top bar + a slide-over
  // drawer instead of the always-visible rail, closing itself once
  // navigation actually changes the route (adjusting state during render,
  // per React's own guidance, rather than a setState-in-effect).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  return (
    <div className="font-didact contents">
      <header className="flex items-center justify-between bg-midnight px-4 py-3.5 print:hidden lg:hidden">
        <Link href="/dashboard" className="text-[15px] tracking-tight text-midnight-ink">
          <Wordmark />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-lg p-2 text-midnight-ink hover:bg-midnight-active-bg"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-midnight px-3 py-5">
            <div className="flex items-center justify-between px-2">
              <span className="text-[16.5px] tracking-tight text-midnight-ink">
                <Wordmark />
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-1.5 text-midnight-ink-muted hover:bg-midnight-active-bg hover:text-midnight-ink"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
                  <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <NavLinks pathname={pathname} setup={setup} locale={locale} />
            <AccountFooter ownerEmail={ownerEmail} locale={locale} />
          </aside>
        </div>
      )}

      {/*
        sticky + top-0 + h-screen (not fixed/min-height) — the sidebar is a
        flex sibling of `main` in the shared dashboard layout, and `main` is
        routinely taller than one viewport. A `fixed` sidebar would need
        `main` to carry a matching margin-left by hand on every page; sticky
        keeps this a one-line change; a bare `min-h-screen` would have grown
        with `main` and painted `bg-midnight` past the real nav content
        instead of solving the disappearing-background bug. Sticky pins the
        rail to the viewport for the whole scroll (its containing block is
        the row-flex layout, which is exactly as tall as the page), so the
        page scrolls as one surface with no nested scroll container — no
        double scrollbar.
      */}
      <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col bg-midnight px-3 py-7 print:hidden lg:flex">
        <Link href="/dashboard" className="px-4 text-[16.5px] tracking-tight text-midnight-ink">
          <Wordmark />
        </Link>
        <NavLinks pathname={pathname} setup={setup} locale={locale} />
        <AccountFooter ownerEmail={ownerEmail} locale={locale} />
      </aside>
    </div>
  );
}

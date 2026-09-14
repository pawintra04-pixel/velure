"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logOut } from "@/app/login/actions";

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4.5 w-4.5 shrink-0">
      <path d={path} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV_ITEMS = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: "M3 10.5 10 4l7 6.5M5 9v7h10V9",
  },
  {
    label: "Bookings",
    href: "/dashboard/bookings",
    icon: "M4 4h12v13H4V4Zm0 4h12M7 2v3M13 2v3",
  },
  {
    label: "Services",
    href: "/dashboard/services",
    icon: "M4 4h6l6 6-6 6-6-6V4Zm3 3h.01",
  },
  {
    label: "Team",
    href: "/dashboard/staff",
    icon: "M7 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm7 1a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM2.5 16c.5-3 2-5 4.5-5s4 2 4.5 5M12.5 12c2 0 3.5 1.7 4 4",
  },
  {
    label: "Classes",
    href: "/dashboard/classes",
    icon: "M4 6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Zm3 3.5h6M7 12.5h4",
  },
  {
    label: "Reports",
    href: "/dashboard/reports",
    icon: "M4 16V9m4.5 7V4m4.5 12v-5m4.5 5V7",
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: "M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm7-2.5a7 7 0 0 1-.1 1.2l1.5 1.2-1.5 2.6-1.8-.6a7 7 0 0 1-2 1.2L12.7 17H7.3l-.4-1.9a7 7 0 0 1-2-1.2l-1.8.6-1.5-2.6L3.1 10.7A7 7 0 0 1 3 10c0-.4 0-.8.1-1.2L1.6 7.6l1.5-2.6 1.8.6a7 7 0 0 1 2-1.2L7.3 3h5.4l.4 1.9a7 7 0 0 1 2 1.2l1.8-.6 1.5 2.6-1.5 1.1c.1.4.1.8.1 1.2Z",
  },
];

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <nav className="mt-8 flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-sidebar-active text-sidebar-ink"
                : "text-sidebar-ink-muted hover:bg-sidebar-active hover:text-sidebar-ink"
            }`}
          >
            <Icon path={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AccountFooter({ ownerEmail }: { ownerEmail: string }) {
  return (
    <div className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-4">
      <div className="truncate px-2 text-xs text-sidebar-ink-muted">{ownerEmail}</div>
      <form action={logOut}>
        <button
          type="submit"
          className="w-full rounded-xl px-3 py-2 text-left text-sm text-sidebar-ink-muted hover:bg-sidebar-active hover:text-sidebar-ink"
        >
          Log out
        </button>
      </form>
    </div>
  );
}

export function Sidebar({ ownerEmail }: { ownerEmail: string }) {
  const pathname = usePathname();
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
    <>
      <header className="flex items-center justify-between bg-sidebar px-4 py-3 print:hidden lg:hidden">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-sidebar-ink">
          Velure
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-lg p-2 text-sidebar-ink hover:bg-sidebar-active"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-sidebar px-3 py-5">
            <div className="flex items-center justify-between px-2">
              <span className="text-lg font-semibold tracking-tight text-sidebar-ink">Velure</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-1.5 text-sidebar-ink-muted hover:bg-sidebar-active hover:text-sidebar-ink"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
                  <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <NavLinks pathname={pathname} />
            <AccountFooter ownerEmail={ownerEmail} />
          </aside>
        </div>
      )}

      <aside className="hidden h-screen w-56 shrink-0 flex-col bg-sidebar px-3 py-5 print:hidden lg:flex">
        <Link href="/dashboard" className="px-2 text-lg font-semibold tracking-tight text-sidebar-ink">
          Velure
        </Link>
        <NavLinks pathname={pathname} />
        <AccountFooter ownerEmail={ownerEmail} />
      </aside>
    </>
  );
}

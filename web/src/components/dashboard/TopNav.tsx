"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logOut } from "@/app/login/actions";

const NAV_ITEMS = [
  { label: "Overview", href: "/dashboard" },
  { label: "Bookings", href: "/dashboard/bookings" },
  { label: "Services", href: "/dashboard/services" },
  { label: "Team", href: "/dashboard/staff" },
  { label: "Reports", href: "/dashboard/reports" },
];

export function TopNav({ ownerEmail }: { ownerEmail?: string }) {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4 print:hidden">
      <div className="flex items-center gap-8">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          Velure
        </Link>
        <nav className="hidden gap-1 sm:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-4 py-1.5 text-sm ${
                pathname === item.href
                  ? "bg-ink text-white"
                  : "text-ink-secondary hover:bg-page"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      {ownerEmail && (
        <form action={logOut} className="flex items-center gap-3">
          <span className="hidden text-sm text-ink-muted sm:inline">{ownerEmail}</span>
          <button
            type="submit"
            className="rounded-full border border-border px-3 py-1.5 text-sm text-ink-secondary hover:bg-page"
          >
            Log out
          </button>
        </form>
      )}
    </header>
  );
}

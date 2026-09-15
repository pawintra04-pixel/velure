import Link from "next/link";

export function QuickActions() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="text-sm text-ink-secondary">Quick actions</div>
      <div className="mt-4 flex flex-col gap-2">
        <Link
          href="/dashboard/services"
          className="rounded-xl border border-border px-4 py-2.5 text-left text-sm hover:bg-page"
        >
          Add service
        </Link>
        <Link
          href="/dashboard/staff"
          className="rounded-xl border border-border px-4 py-2.5 text-left text-sm hover:bg-page"
        >
          Add team member
        </Link>
        <Link
          href="/dashboard/settings"
          className="rounded-xl border border-border px-4 py-2.5 text-left text-sm hover:bg-page"
        >
          Connect Stripe
        </Link>
      </div>
    </div>
  );
}

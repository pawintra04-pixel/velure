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
        {/* Not built yet: no UI for a newly signed-up business to connect
            its own Stripe account (the demo business's was attached by
            hand). Shown disabled rather than a dead link. */}
        <button
          disabled
          className="cursor-not-allowed rounded-xl border border-border px-4 py-2.5 text-left text-sm text-ink-muted"
          title="Not available yet"
        >
          Connect Stripe
          <span className="ml-2 text-xs">(coming soon)</span>
        </button>
      </div>
    </div>
  );
}

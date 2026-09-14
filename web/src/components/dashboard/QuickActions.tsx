const ACTIONS = [
  { label: "New booking" },
  { label: "Add service" },
  { label: "Connect Stripe" },
];

// Disabled on purpose: none of these flows exist yet (booking creation UI,
// service management, Stripe onboarding wired into the real app). Shown so
// the shape of the dashboard is visible without pretending they work.
export function QuickActions() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="text-sm text-ink-secondary">Quick actions</div>
      <div className="mt-4 flex flex-col gap-2">
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            disabled
            className="cursor-not-allowed rounded-xl border border-border px-4 py-2.5 text-left text-sm text-ink-muted"
            title="Not available yet"
          >
            {action.label}
            <span className="ml-2 text-xs">(coming soon)</span>
          </button>
        ))}
      </div>
    </div>
  );
}

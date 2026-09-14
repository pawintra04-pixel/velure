const ACTIONS = [
  { label: "เพิ่มนัดหมาย" },
  { label: "เพิ่มบริการ" },
  { label: "เชื่อมต่อ Stripe" },
];

// Disabled on purpose: none of these flows exist yet (booking creation UI,
// service management, Stripe onboarding wired into the real app). Shown so
// the shape of the dashboard is visible without pretending they work.
export function QuickActions() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="text-sm text-ink-secondary">การดำเนินการด่วน</div>
      <div className="mt-4 flex flex-col gap-2">
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            disabled
            className="cursor-not-allowed rounded-xl border border-border px-4 py-2.5 text-left text-sm text-ink-muted"
            title="ยังไม่เปิดใช้งาน"
          >
            {action.label}
            <span className="ml-2 text-xs">(เร็วๆ นี้)</span>
          </button>
        ))}
      </div>
    </div>
  );
}

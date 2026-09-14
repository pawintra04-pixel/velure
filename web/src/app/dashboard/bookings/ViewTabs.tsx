import Link from "next/link";

const VIEWS = [
  { key: "list", label: "List" },
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

export function ViewTabs({ active, date }: { active: string; date: string }) {
  return (
    <div className="flex gap-1">
      {VIEWS.map((v) => (
        <Link
          key={v.key}
          href={`/dashboard/bookings?view=${v.key}&date=${date}`}
          className={`rounded-full px-4 py-1.5 text-sm ${
            active === v.key ? "bg-ink text-white" : "border border-border text-ink-secondary hover:bg-page"
          }`}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );
}

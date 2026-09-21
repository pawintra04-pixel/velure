import Link from "next/link";

const VIEWS = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

export function CalendarViewTabs({ active, date }: { active: string; date: string }) {
  return (
    <div className="flex gap-1">
      {VIEWS.map((v) => (
        <Link
          key={v.key}
          href={`/dashboard/calendar?view=${v.key}&date=${date}`}
          className={`rounded-full px-4 py-1.5 text-sm ${
            active === v.key ? "bg-midnight text-sunburst" : "border border-border text-ink-secondary hover:bg-page"
          }`}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );
}

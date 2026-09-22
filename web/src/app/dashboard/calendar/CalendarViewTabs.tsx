import Link from "next/link";
import { calendarText, type Locale } from "@/lib/i18n";

export function CalendarViewTabs({ active, date, locale }: { active: string; date: string; locale: Locale }) {
  const t = calendarText[locale];
  const VIEWS = [
    { key: "day", label: t.viewDay },
    { key: "week", label: t.viewWeek },
    { key: "month", label: t.viewMonth },
  ];
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

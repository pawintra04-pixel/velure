import Link from "next/link";
import { bookingsText, type Locale } from "@/lib/i18n";

export function ViewTabs({ active, date, locale }: { active: string; date: string; locale: Locale }) {
  const t = bookingsText[locale];
  const VIEWS = [
    { key: "list", label: t.viewList },
    { key: "day", label: t.viewDay },
    { key: "week", label: t.viewWeek },
    { key: "month", label: t.viewMonth },
  ];
  return (
    <div className="flex gap-1">
      {VIEWS.map((v) => (
        <Link
          key={v.key}
          href={`/dashboard/bookings?view=${v.key}&date=${date}`}
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

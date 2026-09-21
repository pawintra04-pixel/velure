import Link from "next/link";

export const SETTINGS_SECTIONS = [
  { key: "business", label: "Business" },
  { key: "hours", label: "Opening hours" },
  { key: "payments", label: "Payments" },
] as const;

export type SettingsSectionKey = (typeof SETTINGS_SECTIONS)[number]["key"];

export function SettingsTabs({ active }: { active: SettingsSectionKey }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SETTINGS_SECTIONS.map((s) => (
        <Link
          key={s.key}
          href={`/dashboard/settings?section=${s.key}`}
          className={`rounded-full px-4 py-1.5 text-sm ${
            active === s.key ? "bg-midnight text-sunburst" : "border border-border text-ink-secondary hover:bg-page"
          }`}
        >
          {s.label}
        </Link>
      ))}
    </div>
  );
}

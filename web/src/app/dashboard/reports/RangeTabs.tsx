import Link from "next/link";
import type { ReportRangeKey } from "@/lib/reports-data";

export function RangeTabs({
  ranges,
  active,
}: {
  ranges: { key: ReportRangeKey; label: string }[];
  active: ReportRangeKey;
}) {
  return (
    <>
      {ranges.map((r) => (
        <Link
          key={r.key}
          href={`/dashboard/reports?range=${r.key}`}
          className={`rounded-full px-4 py-1.5 text-sm ${
            active === r.key ? "bg-midnight text-sunburst" : "border border-border text-ink-secondary hover:bg-page"
          }`}
        >
          {r.label}
        </Link>
      ))}
    </>
  );
}

"use client";

import { useState } from "react";
import type { MonthlyRevenuePoint } from "@/lib/dashboard-data";
import { formatBaht } from "@/lib/money";

export function RevenueChart({ data }: { data: MonthlyRevenuePoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.totalSatang));
  const latestIndex = data.length - 1;
  const activeIndex = hovered ?? latestIndex;
  const active = data[activeIndex];

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-sm text-ink-secondary">รายได้รายเดือน</div>
          <div className="mt-1 text-2xl font-semibold">
            {active ? formatBaht(active.totalSatang) : "฿0"}
            <span className="ml-2 text-sm font-normal text-ink-muted">
              {active?.label}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex h-40 items-end gap-3 border-b border-gridline">
        {data.map((d, i) => {
          const heightPct = Math.max(4, (d.totalSatang / max) * 100);
          const isActive = i === activeIndex;
          return (
            <div
              key={d.label}
              className="relative flex h-full flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {isActive && (
                <div className="absolute -top-8 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-white">
                  {formatBaht(d.totalSatang)}
                </div>
              )}
              <div
                className="w-full max-w-6 rounded-t-[4px] transition-colors"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: isActive ? "var(--accent)" : "var(--gridline)",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-3">
        {data.map((d) => (
          <div key={d.label} className="flex-1 text-center text-xs text-ink-muted">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

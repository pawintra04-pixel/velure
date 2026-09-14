import type { BookingStatusBreakdown } from "@/lib/dashboard-data";

// Fixed status colors (not the categorical palette) — these encode booking
// STATE, not series identity, so they use the reserved good/warning/critical
// roles consistently with how status badges are colored elsewhere in the app.
const SEGMENTS = [
  { key: "confirmed" as const, label: "Confirmed", color: "#0ca30c" },
  { key: "pending" as const, label: "Pending", color: "#fab219" },
  { key: "cancelled" as const, label: "Cancelled/no-show", color: "#d03b3b" },
];

const SIZE = 140;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function BookingStatusDonut({ data }: { data: BookingStatusBreakdown }) {
  const total = data.confirmed + data.pending + data.cancelled;

  let cumulative = 0;
  const arcs = SEGMENTS.map((seg) => {
    const value = data[seg.key];
    const fraction = total > 0 ? value / total : 0;
    const dash = fraction * CIRCUMFERENCE;
    const arc = {
      ...seg,
      value,
      dashArray: `${dash} ${CIRCUMFERENCE - dash}`,
      rotation: cumulative * 360,
    };
    cumulative += fraction;
    return arc;
  });

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="text-sm text-ink-secondary">Bookings this month</div>
      <div className="mt-4 flex items-center gap-6">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--gridline)"
            strokeWidth={STROKE}
          />
          {total > 0 &&
            arcs.map(
              (arc) =>
                arc.value > 0 && (
                  <circle
                    key={arc.key}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={STROKE}
                    strokeDasharray={arc.dashArray}
                    strokeLinecap="butt"
                    transform={`rotate(${arc.rotation - 90} ${SIZE / 2} ${SIZE / 2})`}
                  />
                )
            )}
          <text
            x={SIZE / 2}
            y={SIZE / 2}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-ink text-2xl font-semibold"
          >
            {total}
          </text>
        </svg>

        <div className="flex flex-col gap-2">
          {SEGMENTS.map((seg) => (
            <div key={seg.key} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
              <span className="text-ink-secondary">{seg.label}</span>
              <span className="font-medium text-ink">{data[seg.key]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

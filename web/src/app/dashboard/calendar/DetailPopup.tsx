"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

// A calendar block that opens its full detail in a small dialog on click,
// instead of jumping the page down to the matching card in the list below.
// The detail itself is server-rendered (passed in as `detail`) so it reuses
// the exact same BookingRow / ClassSessionDetail — and their real server
// actions — the list uses; this component only owns open/close.
export function DetailPopup({
  children,
  detail,
  title,
  tooltip,
  closeLabel,
  className,
  style,
}: {
  children: ReactNode;
  detail: ReactNode;
  title: string;
  tooltip?: string;
  closeLabel: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title={tooltip} className={`text-left ${className ?? ""}`} style={style}>
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-[15px] text-ink">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={closeLabel}
                className="rounded-lg p-1.5 text-ink-muted hover:bg-page hover:text-ink"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
                  <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto p-4">{detail}</div>
          </div>
        </div>
      )}
    </>
  );
}

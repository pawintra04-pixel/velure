"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-full border border-border px-4 py-1.5 text-sm text-ink-secondary hover:bg-page"
    >
      Print
    </button>
  );
}

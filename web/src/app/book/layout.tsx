import { EmbedAutoResize } from "@/components/booking/EmbedAutoResize";

// Wraps every page under /book/* (service select, time picker, details,
// pay, confirmed, manage) — one place for anything that should apply to
// the whole public booking funnel regardless of which step a visitor is
// on, starting with the embed auto-resize reporter (see its own comment).
export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <EmbedAutoResize />
      {children}
    </>
  );
}

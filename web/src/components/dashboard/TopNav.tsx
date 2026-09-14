import { logOut } from "@/app/login/actions";

const NAV_ITEMS = ["Overview", "Bookings", "Services", "Team", "Customers"];

export function TopNav({ ownerEmail }: { ownerEmail?: string }) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
      <div className="flex items-center gap-8">
        <span className="text-lg font-semibold tracking-tight">Velure</span>
        <nav className="hidden gap-1 sm:flex">
          {NAV_ITEMS.map((item, i) => (
            <button
              key={item}
              className={`rounded-full px-4 py-1.5 text-sm ${
                i === 0
                  ? "bg-ink text-white"
                  : "text-ink-secondary hover:bg-page"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>
      </div>
      {ownerEmail && (
        <form action={logOut} className="flex items-center gap-3">
          <span className="hidden text-sm text-ink-muted sm:inline">{ownerEmail}</span>
          <button
            type="submit"
            className="rounded-full border border-border px-3 py-1.5 text-sm text-ink-secondary hover:bg-page"
          >
            Log out
          </button>
        </form>
      )}
    </header>
  );
}

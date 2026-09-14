"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink-secondary">{error.message}</p>
      <button
        onClick={reset}
        className="mt-6 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
      >
        Try again
      </button>
    </div>
  );
}

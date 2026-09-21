import type { Instrumentation } from "next";

// Central catch for every uncaught server error (Server Components, Route
// Handlers, Server Actions — see docs/file-conventions/instrumentation.md)
// so the platform admin dashboard (src/app/admin) has something to show,
// instead of errors only ever existing in Vercel's function logs. This
// deliberately does NOT catch the app's own handled `{ ok: false, error }`
// results (booking conflicts, validation messages) — those are expected
// outcomes, not bugs, and never throw in the first place.
//
// No edge routes exist in this app (grep confirms no `export const runtime
// = "edge"` anywhere), so importing the Node-only `pg`-backed error logger
// here is safe — this file would need a runtime split (see the Next.js
// docs) if that ever changes.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { logAppError } = await import("@/lib/error-log");

  const message = err instanceof Error ? err.message : String(err);
  const digest =
    typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : null;

  await logAppError({
    message,
    routePath: request.path,
    routeType: context.routeType,
    digest,
  });
};

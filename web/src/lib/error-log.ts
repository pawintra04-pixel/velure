import { adminPool } from "@/db/client";

/**
 * Records an uncaught server error so the platform admin dashboard has
 * something to show (see src/instrumentation.ts, the only real caller).
 * Deliberately swallows its own failures — logging an error must never be
 * the thing that turns one error into two (or masks the original with a
 * new unhandled rejection).
 */
export async function logAppError(params: {
  message: string;
  routePath?: string | null;
  routeType?: string | null;
  digest?: string | null;
  businessId?: string | null;
}): Promise<void> {
  try {
    await adminPool.query(
      `INSERT INTO app_errors (message, route_path, route_type, digest, business_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        params.message.slice(0, 2000),
        params.routePath ?? null,
        params.routeType ?? null,
        params.digest ?? null,
        params.businessId ?? null,
      ]
    );
  } catch (err) {
    console.error("logAppError failed", err);
  }
}

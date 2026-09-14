import pg from "pg";

const appDatabaseUrl =
  process.env.APP_DATABASE_URL ??
  "postgres://app_user:app_user_dev_password@localhost:54320/velure_dev";

const adminDatabaseUrl =
  process.env.DATABASE_URL ??
  "postgres://velure:velure_dev_password@localhost:54320/velure_dev";

/**
 * Connects as the non-superuser `app_user` role, which RLS actually applies
 * to (see spikes/tenant-isolation/RESULT.md). Use this for every normal
 * request path.
 */
export const appPool = new pg.Pool({ connectionString: appDatabaseUrl });

/**
 * Connects as the superuser role, which bypasses RLS entirely. Legitimate
 * uses are narrow: migrations, seed scripts, and the Stripe webhook handler's
 * initial "which business owns this stripe_account_id / payment_intent?"
 * lookup (that lookup has no business context yet — that's the whole point
 * of it). Never use this to serve a request scoped to a specific business;
 * use `withBusinessContext` + `appPool` for that instead.
 */
export const adminPool = new pg.Pool({ connectionString: adminDatabaseUrl });

/**
 * Runs `fn` inside a transaction with the tenant GUC set for its duration —
 * the same pattern proven in spikes/tenant-isolation/src/run.ts. Every
 * business-scoped query in the app should go through this, not appPool
 * directly, so RLS always has a tenant to check against.
 */
export async function withBusinessContext<T>(
  businessId: string,
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await appPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_business_id', $1, true)", [
      businessId,
    ]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

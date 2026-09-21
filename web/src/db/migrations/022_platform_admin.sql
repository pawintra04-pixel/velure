-- Platform-operator accounts: the person running Velure itself, distinct
-- from a business owner (owners/sessions, 009_auth.sql) — mirrors that
-- table pair exactly, just for a separate identity that can see across
-- every business. Never RLS-scoped, same reasoning as owners: looking
-- someone up by email/session token happens before any business context
-- exists. Only ever touched via adminPool.
CREATE TABLE platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES platform_admins(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON admin_sessions (admin_id);

-- Uncaught server-side errors (see src/instrumentation.ts's onRequestError
-- hook), so the platform operator has somewhere to actually see them instead
-- of only Vercel's function logs. business_id is nullable and NOT a foreign
-- key on purpose: an error can happen before any business context exists
-- (e.g. a malformed request, a bug in a public page), and a FK would risk
-- the error insert itself failing if the referenced business was deleted.
CREATE TABLE app_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  route_path TEXT,
  route_type TEXT,
  message TEXT NOT NULL,
  digest TEXT,
  business_id UUID
);
CREATE INDEX ON app_errors (occurred_at DESC);

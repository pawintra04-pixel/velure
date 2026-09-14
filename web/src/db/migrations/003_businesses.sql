CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  -- Per docs/ARCHITECTURE.md: all timestamps stored UTC, each business
  -- carries its own timezone for render-time conversion.
  timezone TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  stripe_account_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON businesses TO app_user;

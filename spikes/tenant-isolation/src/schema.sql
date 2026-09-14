CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL
);

-- Non-superuser role the application connects as. Superusers and roles with
-- BYPASSRLS always skip row-level security regardless of policy or FORCE —
-- so the whole spike is pointless if the app pool connects as the setup
-- superuser. This is the actual app connection identity.
CREATE ROLE app_user LOGIN PASSWORD 'app_user';
GRANT CONNECT ON DATABASE velure_spike TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT ON bookings TO app_user;

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
-- FORCE so RLS applies even to the table owner (the setup role also owns it).
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;

-- current_setting(..., true) returns NULL when the GUC was never declared at
-- all, but a pooled connection that previously used SET LOCAL on this custom
-- param reverts to '' (empty string), not NULL, once that transaction ends —
-- Postgres creates a placeholder for undeclared custom GUCs the first time
-- they're set, and the placeholder's "unset" value is ''. NULLIF(...,'') folds
-- both cases to NULL so the cast never errors; NULL = anything is NULL, not
-- true, so a session with no business context set sees ZERO rows, not all —
-- fails closed, not open, and without throwing.
CREATE POLICY tenant_isolation ON bookings
  USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

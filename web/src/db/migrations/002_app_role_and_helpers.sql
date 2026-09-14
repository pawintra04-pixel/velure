-- Non-superuser role the application connects as for all real request
-- handling. Superusers and BYPASSRLS roles always skip row-level security
-- regardless of FORCE — proven the hard way in spikes/tenant-isolation.
-- Migrations/seeding still run as the superuser (they legitimately need to
-- see/write across all tenants).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'app_user_dev_password';
  END IF;
END
$$;

-- current_business_id(): the single place every RLS policy reads the
-- authenticated tenant from. NULLIF(...,'') guards against the pooled-
-- connection footgun found in spikes/tenant-isolation/RESULT.md — a custom
-- GUC that was ever SET LOCAL on a connection reverts to '' (not NULL) once
-- that transaction ends, and casting '' to uuid throws instead of denying.
CREATE OR REPLACE FUNCTION current_business_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_business_id', true), '')::uuid
$$ LANGUAGE sql STABLE;

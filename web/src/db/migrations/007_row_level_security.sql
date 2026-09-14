-- Applies the pattern proven in spikes/tenant-isolation to every
-- business-scoped table: enable + FORCE RLS (so it applies even to the
-- table owner, which is the migration-running superuser role — app_user is
-- a separate non-superuser role that never bypasses this), one policy per
-- table using current_business_id() from 002_app_role_and_helpers.sql.
--
-- `businesses` itself is scoped by its own `id`, not a `business_id` column.

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON businesses USING (id = current_business_id());

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON staff USING (business_id = current_business_id());

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON resources USING (business_id = current_business_id());

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE services FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON services USING (business_id = current_business_id());

ALTER TABLE staff_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_services FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON staff_services USING (business_id = current_business_id());

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customers USING (business_id = current_business_id());

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bookings USING (business_id = current_business_id());

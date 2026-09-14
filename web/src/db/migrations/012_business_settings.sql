-- Business profile fields shown to customers on the public booking page,
-- plus real per-weekday operating hours and per-staff schedules — this
-- replaces availability.ts's hardcoded 09:00-19:00-every-day-for-everyone
-- stub with actual owner-configurable data, closing a gap the README has
-- flagged since the booking flow was first built end to end.

ALTER TABLE businesses ADD COLUMN business_type TEXT;
ALTER TABLE businesses ADD COLUMN logo_url TEXT;
ALTER TABLE businesses ADD COLUMN description TEXT;
ALTER TABLE businesses ADD COLUMN address TEXT;
ALTER TABLE businesses ADD COLUMN contact_phone TEXT;
ALTER TABLE businesses ADD COLUMN contact_email TEXT;

-- One row per business per weekday (0=Sunday..6=Saturday, matching
-- Postgres's own EXTRACT(DOW)). is_closed avoids needing a sentinel time
-- range for "not open this day."
CREATE TABLE business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_closed BOOLEAN NOT NULL DEFAULT false,
  open_time TIME,
  close_time TIME,
  CHECK (is_closed OR (open_time IS NOT NULL AND close_time IS NOT NULL AND close_time > open_time)),
  UNIQUE (business_id, day_of_week)
);
CREATE INDEX ON business_hours (business_id);

-- One row per staff member per weekday: working hours plus at most one
-- break window. availability.ts intersects this with the business's own
-- hours for that weekday — a staff member can never be bookable outside
-- either, and never during their own break.
CREATE TABLE staff_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_off BOOLEAN NOT NULL DEFAULT false,
  start_time TIME,
  end_time TIME,
  break_start TIME,
  break_end TIME,
  CHECK (is_off OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)),
  CHECK ((break_start IS NULL) = (break_end IS NULL)),
  CHECK (
    break_start IS NULL
    OR (break_start >= start_time AND break_end <= end_time AND break_end > break_start)
  ),
  UNIQUE (staff_id, day_of_week)
);
CREATE INDEX ON staff_hours (business_id);
CREATE INDEX ON staff_hours (staff_id);

ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON business_hours USING (business_id = current_business_id());

ALTER TABLE staff_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_hours FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON staff_hours USING (business_id = current_business_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON business_hours TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON staff_hours TO app_user;

-- Backfill every existing business/staff member with the same hours
-- availability.ts used to hardcode, so nothing changes for them until an
-- owner actually visits Settings. New businesses/staff get rows inserted
-- at creation time instead (signup and addStaff).
INSERT INTO business_hours (business_id, day_of_week, is_closed, open_time, close_time)
SELECT b.id, d.dow, false, '09:00', '19:00'
FROM businesses b, generate_series(0, 6) AS d(dow)
ON CONFLICT (business_id, day_of_week) DO NOTHING;

INSERT INTO staff_hours (business_id, staff_id, day_of_week, is_off, start_time, end_time)
SELECT s.business_id, s.id, d.dow, false, '09:00', '19:00'
FROM staff s, generate_series(0, 6) AS d(dow)
ON CONFLICT (staff_id, day_of_week) DO NOTHING;

-- Manual booking (staff takes a booking over the phone/walk-in) and block
-- time (staff marks themselves unavailable without a fake booking) — both
-- flagged as P0-before-pilot after an external review: real shops keep
-- taking bookings by phone/LINE/walk-in no matter what online flow exists,
-- and Velure can only actually prevent double-booking if staff can get
-- those into the same system easily.

-- Marks a booking as created directly by staff rather than through the
-- online quick-booking flow — informational only (dashboard/reporting can
-- distinguish "came in online" vs "phoned in"), no behavioral difference.
ALTER TABLE bookings ADD COLUMN created_by_staff BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE staff_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  CHECK (end_time > start_time),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON staff_blocks (business_id);
CREATE INDEX ON staff_blocks (staff_id, start_time);

-- One staff member can't have two overlapping blocks. This constraint
-- only guards staff_blocks against itself — it can't see bookings or
-- class_sessions (a single EXCLUDE constraint can't span tables), so
-- cross-table conflicts (a block during an existing booking, a booking
-- during an existing block) are checked at the application level via
-- lib/staff-availability.ts, the same non-atomic-but-checked-in-the-same-
-- transaction approach already used for 1:1-vs-class conflicts (see
-- migration 013's note) — not a new category of gap, the same one,
-- now shared by three tables instead of two.
ALTER TABLE staff_blocks ADD CONSTRAINT no_overlapping_staff_blocks
  EXCLUDE USING gist (staff_id WITH =, tstzrange(start_time, end_time) WITH &&);

ALTER TABLE staff_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_blocks FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON staff_blocks USING (business_id = current_business_id());
GRANT SELECT, INSERT, DELETE ON staff_blocks TO app_user;

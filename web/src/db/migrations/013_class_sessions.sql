-- Multi-seat "class" bookings (e.g. a yoga class with 10 spots), on top of
-- the existing one-customer-one-staff-one-slot model rather than replacing
-- it. A class is a service with a capacity; a class_session is one
-- scheduled occurrence of it (a specific staff member, start/end time,
-- capacity); each attendee is still a normal row in `bookings` — reusing
-- its entire existing customer/status/payment/cancellation machinery —
-- tagged with which session it belongs to.

ALTER TABLE services ADD COLUMN capacity INT CHECK (capacity IS NULL OR capacity > 0);
-- NULL or 1 = an ordinary 1:1 service (default, no behavior change).
-- >1 = a class: customers book a seat in a scheduled session instead of an
-- arbitrary dynamically-computed slot.

CREATE TABLE class_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  service_id UUID NOT NULL REFERENCES services(id),
  staff_id UUID NOT NULL REFERENCES staff(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  CHECK (end_time > start_time),
  capacity INT NOT NULL CHECK (capacity > 0),
  -- The actual capacity guard: registering a seat does
  -- `UPDATE ... SET seats_booked = seats_booked + 1 WHERE seats_booked < capacity`
  -- (see book/actions.ts's reserveClassSeat) — atomic and race-safe the
  -- same way the 1:1 flow's exclusion constraint is, just via a counter
  -- instead of a range-overlap check, since "N of these are allowed to
  -- coexist" isn't expressible as an EXCLUDE constraint.
  seats_booked INT NOT NULL DEFAULT 0 CHECK (seats_booked >= 0 AND seats_booked <= capacity),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON class_sessions (business_id);
CREATE INDEX ON class_sessions (staff_id, start_time);

-- A staff member can't run two class sessions at once — same overlap
-- guard as bookings' own no_overlapping_staff_bookings below.
ALTER TABLE class_sessions ADD CONSTRAINT no_overlapping_class_sessions
  EXCLUDE USING gist (staff_id WITH =, tstzrange(start_time, end_time) WITH &&);

ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON class_sessions USING (business_id = current_business_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON class_sessions TO app_user;

ALTER TABLE bookings ADD COLUMN class_session_id UUID REFERENCES class_sessions(id);

-- Multiple attendees of the SAME class session legitimately share an
-- identical (staff_id, time range) — the old version of this constraint
-- would treat every attendee past the first as a collision. Scope it to
-- class_session_id IS NULL (ordinary 1:1 bookings only); class capacity is
-- enforced separately by the seats_booked counter above, so this
-- constraint's only remaining job is "one staff member, one 1:1 thing at a
-- time."
--
-- Known gap: with class-tagged bookings excluded here, nothing at the
-- database level stops a NEW 1:1 booking from being scheduled for the same
-- staff member during an active class session's time — createQuickHold
-- adds an explicit application-level check for that instead, which (unlike
-- this constraint) is not atomic: a narrow check-then-insert race exists
-- between a class being scheduled and a concurrent 1:1 hold for the same
-- staff/time. Documented rather than solved in this pass — the reverse
-- direction (two class sessions colliding, or a class collidding with an
-- existing 1:1 booking) is still fully guarded by the two EXCLUDE
-- constraints, since a class session insert (class_sessions row) always
-- happens before any of its bookings rows exist.
ALTER TABLE bookings DROP CONSTRAINT no_overlapping_staff_bookings;
ALTER TABLE bookings ADD CONSTRAINT no_overlapping_staff_bookings
  EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (status IN ('TEMPORARY_HOLD', 'PAYMENT_PENDING', 'CONFIRMED') AND class_session_id IS NULL);

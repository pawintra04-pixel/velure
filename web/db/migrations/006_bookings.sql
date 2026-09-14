-- Single source-of-truth state machine per docs/ARCHITECTURE.md — no
-- separate isPaid/isConfirmed booleans.
CREATE TYPE booking_status AS ENUM (
  'TEMPORARY_HOLD',
  'PAYMENT_PENDING',
  'CONFIRMED',
  'COMPLETED',
  'NO_SHOW',
  'PAYMENT_FAILED',
  'EXPIRED',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED'
);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  service_id UUID NOT NULL REFERENCES services(id),
  staff_id UUID NOT NULL REFERENCES staff(id),
  resource_id UUID REFERENCES resources(id),
  -- Nullable: a TEMPORARY_HOLD may exist before we've collected who the
  -- customer is (e.g. hold-then-checkout-form flows).
  customer_id UUID REFERENCES customers(id),

  start_time TIMESTAMPTZ NOT NULL,
  -- Stored explicitly (rather than derived at query time) so the exclusion
  -- constraint below and any range query can use it directly.
  end_time TIMESTAMPTZ NOT NULL,
  CHECK (end_time > start_time),

  status booking_status NOT NULL DEFAULT 'TEMPORARY_HOLD',
  -- TEMPORARY_HOLD rows must resolve (pay or expire) by this time; a
  -- background sweeper transitions expired holds to EXPIRED. See
  -- docs/ARCHITECTURE.md's temporary-hold TTL requirement.
  hold_expires_at TIMESTAMPTZ,

  -- Payment metadata only — informational/audit trail, NOT the source of
  -- truth for booking lifecycle (that's `status` above). Mirrors the exact
  -- field list docs/ARCHITECTURE.md allows us to store.
  stripe_customer_id TEXT,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_payment_status TEXT,
  amount INT NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'thb',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON bookings (business_id);
CREATE INDEX ON bookings (business_id, start_time);
CREATE INDEX ON bookings (stripe_payment_intent_id);

-- The actual double-booking guard. spikes/atomic-booking proved the
-- technique (a partial unique index on exact start_time); this is the
-- production version, upgraded to an overlap-range exclusion constraint so
-- two bookings that overlap WITHOUT sharing an identical start_time (real
-- services have duration + buffer) still collide correctly. "Active" =
-- slot-occupying, same status list the RLS/hold logic must stay in sync
-- with — see spikes/atomic-booking/RESULT.md's "carry into the real
-- schema" note.
ALTER TABLE bookings ADD CONSTRAINT no_overlapping_staff_bookings
  EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (status IN ('TEMPORARY_HOLD', 'PAYMENT_PENDING', 'CONFIRMED'));

-- Same guard for the physical resource (room/equipment), independent of
-- which staff member is assigned — "หมอนวดว่างแต่ห้องเต็ม" case in the
-- product blueprint. NULL resource_id bookings (services with no room/
-- equipment requirement) are correctly excluded from this constraint.
ALTER TABLE bookings ADD CONSTRAINT no_overlapping_resource_bookings
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (status IN ('TEMPORARY_HOLD', 'PAYMENT_PENDING', 'CONFIRMED') AND resource_id IS NOT NULL);

GRANT SELECT, INSERT, UPDATE ON bookings TO app_user;

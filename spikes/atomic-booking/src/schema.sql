CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE booking_status AS ENUM (
  'TEMPORARY_HOLD',
  'PAYMENT_PENDING',
  'CONFIRMED',
  'COMPLETED',
  'NO_SHOW',
  'PAYMENT_FAILED',
  'EXPIRED',
  'CANCELLED'
);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  staff_id UUID NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  status booking_status NOT NULL DEFAULT 'TEMPORARY_HOLD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one row per (staff_id, start_time) may be in a slot-occupying status at a time.
-- This is the DB-level guarantee the architecture doc calls for — collision must be
-- rejected here, not in application code, because two holds can race the same millisecond.
CREATE UNIQUE INDEX uniq_active_slot ON bookings (staff_id, start_time)
  WHERE status IN ('TEMPORARY_HOLD', 'PAYMENT_PENDING', 'CONFIRMED');

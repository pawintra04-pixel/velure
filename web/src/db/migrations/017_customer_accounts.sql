-- Customer accounts, scoped per business — matching how `customers`
-- already works (one row per business per phone, no cross-business
-- identity). A customer signs up/logs in on one specific shop's booking
-- site and sees only their bookings with that shop; this is deliberately
-- not a unified cross-tenant identity, which would cut against the whole
-- RLS-per-business model everything else here relies on. Quick-booking
-- (no account) keeps working exactly as before via the unguessable
-- /book/manage/[bookingId] link — this is additive, not a replacement.
ALTER TABLE customers ADD COLUMN password_hash TEXT;

-- Same shape as owners/sessions (009_auth.sql): not RLS-scoped, since
-- looking someone up by email/session token necessarily precedes knowing
-- their business — only ever touched via adminPool.
CREATE TABLE customer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON customer_sessions (customer_id);

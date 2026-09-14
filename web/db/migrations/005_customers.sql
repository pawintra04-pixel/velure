CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON customers (business_id);

-- Dedupe by phone/email per business, per docs/ARCHITECTURE.md — partial so
-- a business can have any number of customers with no phone/email on file.
CREATE UNIQUE INDEX customers_business_phone_key ON customers (business_id, phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX customers_business_email_key ON customers (business_id, email) WHERE email IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON customers TO app_user;

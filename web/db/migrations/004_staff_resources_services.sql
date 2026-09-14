CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON staff (business_id);

CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON resources (business_id);

CREATE TYPE payment_mode AS ENUM ('free', 'deposit', 'full');

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  buffer_minutes INT NOT NULL DEFAULT 0 CHECK (buffer_minutes >= 0),
  -- Amounts in satang (THB's smallest unit), matching how Stripe wants them.
  price_amount INT NOT NULL CHECK (price_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'thb',
  payment_mode payment_mode NOT NULL DEFAULT 'full',
  deposit_amount INT CHECK (deposit_amount IS NULL OR deposit_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT deposit_amount_required_for_deposit_mode
    CHECK (payment_mode != 'deposit' OR deposit_amount IS NOT NULL)
);
CREATE INDEX ON services (business_id);

-- Which staff can perform which service. A booking's staff_id must be one
-- of a service's assigned staff — enforced at the application layer when
-- creating a hold (a DB-level FK-style check across two columns needs a
-- trigger; not worth it before real usage shows it's needed).
CREATE TABLE staff_services (
  business_id UUID NOT NULL REFERENCES businesses(id),
  staff_id UUID NOT NULL REFERENCES staff(id),
  service_id UUID NOT NULL REFERENCES services(id),
  PRIMARY KEY (staff_id, service_id)
);
CREATE INDEX ON staff_services (business_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON staff, resources, services, staff_services TO app_user;

-- Packages & memberships, v1 scope (smallest production-safe version, per
-- the roadmap's own phase-execution rule): one package = a bundle of N
-- sessions of exactly one service, sold by the owner in person (cash or
-- already-paid-elsewhere — no new Stripe charge flow yet, see
-- src/lib/packages.ts's comment for why), redeemed by the owner creating a
-- booking against a customer's remaining balance. No self-serve online
-- purchase or multi-service bundles in this pass.
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  service_id UUID NOT NULL REFERENCES services(id),
  name TEXT NOT NULL,
  session_count INT NOT NULL CHECK (session_count >= 2),
  price_amount INT NOT NULL CHECK (price_amount >= 0),
  -- NULL = never expires. Applied at purchase time (package_purchases.expires_at),
  -- not re-derived later, so changing a package's validity_days afterward
  -- never retroactively changes an already-sold purchase's expiry.
  validity_days INT CHECK (validity_days IS NULL OR validity_days > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON packages (business_id, service_id);

-- One customer's actual holding of a package they bought. sessions_remaining
-- is the real balance — redeemed via an atomic
-- `UPDATE ... SET sessions_remaining = sessions_remaining - 1
--  WHERE sessions_remaining > 0` (see src/lib/packages.ts), the same
-- compare-and-swap shape claimClassSeat already uses for seat capacity, so
-- two concurrent redemption attempts can't both succeed and drive the
-- balance negative.
CREATE TABLE package_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  package_id UUID NOT NULL REFERENCES packages(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  sessions_total INT NOT NULL,
  sessions_remaining INT NOT NULL CHECK (sessions_remaining >= 0),
  price_paid_amount INT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'promptpay', 'other')),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  -- 'refunded' is set by hand by the owner for a purchase with nothing
  -- redeemed yet (v1 doesn't do partial/prorated refunds — see the Phase
  -- plan's Payment Impact note); a purchase with any redemption already
  -- made is refunded outside this table, the same case-by-case way any
  -- other partially-used real-world purchase would be.
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'refunded'))
);
CREATE INDEX ON package_purchases (customer_id, status);

-- Nullable: only set on a booking that was actually paid for by redeeming
-- a package session, so reports/exports can tell package-covered bookings
-- apart from cash/card/promptpay ones (bookings.payment_method, added in
-- 020_payment_methods.sql, doesn't have a 'package' option — the
-- package_purchase_id link is the source of truth for that instead of
-- overloading the existing enum).
ALTER TABLE bookings ADD COLUMN package_purchase_id UUID REFERENCES package_purchases(id);

ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON packages USING (business_id = current_business_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON packages TO app_user;

ALTER TABLE package_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_purchases FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON package_purchases USING (business_id = current_business_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON package_purchases TO app_user;

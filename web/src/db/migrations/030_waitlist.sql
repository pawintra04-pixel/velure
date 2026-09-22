-- Waitlist, v1 scope (smallest production-safe version, per the roadmap's
-- own phase-execution rule): a customer who can't find a slot on their
-- preferred day leaves their contact info against (service, date). When a
-- booking for that service on that date is cancelled, the single
-- longest-waiting entry is notified with a link back to the booking page —
-- never an automatic reservation (existing booking constraints stay
-- authoritative, first-come-first-served same as any other visitor).
--
-- No exact-time matching, no staff preference, no auto-expiry in this pass:
-- a cancellation on the target date is itself the proof a slot opened, so
-- matching only needs (business_id, service_id, target_date) — see
-- src/lib/waitlist.ts for why this is simpler and still correct.
CREATE TABLE waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  service_id UUID NOT NULL REFERENCES services(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  target_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'cancelled')),
  notified_at TIMESTAMPTZ,
  notified_channels TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Matches the exact lookup checkWaitlistForCancelledSlot runs: oldest
-- 'waiting' row for a given (business, service, date).
CREATE INDEX ON waitlist_entries (business_id, service_id, target_date, status, created_at);

ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON waitlist_entries USING (business_id = current_business_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON waitlist_entries TO app_user;

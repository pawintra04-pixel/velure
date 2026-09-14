-- Webhook idempotency, production version of the check proven in
-- spikes/stripe-connect-promptpay: key on Stripe's event.id (not
-- payment_intent_id — one payment produces multiple event types hitting the
-- same endpoint, e.g. charge.updated alongside payment_intent.succeeded).
-- A dedicated table (rather than a status-based check on the booking row)
-- survives out-of-order delivery: a stale retried event can't re-apply an
-- effect just because the booking's status has since moved on.
CREATE TABLE processed_stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No RLS here: the webhook handler runs before any business is known (see
-- adminPool's doc comment in db/client.ts) and this table has no
-- business_id — it's a cross-tenant dedup ledger, not tenant data.
GRANT SELECT, INSERT ON processed_stripe_events TO app_user;

-- Central delivery record for every (booking, event, channel) notification
-- attempt — replaces 6 previously-untracked fire-and-forget call sites
-- across book/actions.ts, the Stripe webhook, and 3 dashboard action files
-- (see src/lib/notifications.ts, the one place that now writes here).
-- Internal-only, same category as processed_stripe_events: never RLS'd,
-- only ever touched via adminPool, no owner-facing UI (shown on /admin
-- instead, alongside app_errors).
--
-- The UNIQUE constraint is this table's actual idempotency guarantee — an
-- ON CONFLICT upsert in notify() means calling notify() twice for the same
-- (booking, event, channel) updates one row instead of creating a second
-- attempt, and a channel already marked 'sent' is skipped entirely before
-- ever reaching the send function again.
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID,
  booking_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
  error TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id, event_type, channel)
);
CREATE INDEX ON notification_log (status, attempted_at) WHERE status = 'failed';

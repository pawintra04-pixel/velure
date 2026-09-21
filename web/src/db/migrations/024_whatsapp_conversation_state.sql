-- Tracks the last time the full button menu was sent to a given customer
-- number, per business — so a customer sending several free-text messages
-- in a row (that don't match a keyword) gets a short nudge instead of the
-- identical interactive menu card resent every single time, which read as
-- spammy/robotic in practice. Not a chat-history table: one row per
-- (business, customer number), overwritten each time, nothing to clean up.
CREATE TABLE whatsapp_conversations (
  business_id UUID NOT NULL REFERENCES businesses(id),
  wa_id TEXT NOT NULL,
  last_menu_sent_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (business_id, wa_id)
);

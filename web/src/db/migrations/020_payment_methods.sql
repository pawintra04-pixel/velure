-- Cash as a real third payment option alongside Stripe card/PromptPay, plus
-- per-business toggles for which methods are actually offered at checkout —
-- a shop with no card reader might want card off, one still mid-Stripe-setup
-- might want to lean on cash in the meantime, etc.
ALTER TABLE businesses ADD COLUMN accepts_card BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE businesses ADD COLUMN accepts_promptpay BOOLEAN NOT NULL DEFAULT true;
-- Defaults to false (opt-in): existing businesses keep exactly today's
-- card/PromptPay-only checkout until an owner deliberately turns cash on.
ALTER TABLE businesses ADD COLUMN accepts_cash BOOLEAN NOT NULL DEFAULT false;

-- Which method was actually used — lets the dashboard show "Cash — collect
-- ฿500 at the door" distinctly from a free booking (both currently look
-- identical: no stripe_payment_intent_id). NULL for bookings with no
-- payment required and for bookings made before this column existed.
ALTER TABLE bookings ADD COLUMN payment_method TEXT
  CHECK (payment_method IS NULL OR payment_method IN ('card', 'promptpay', 'cash'));

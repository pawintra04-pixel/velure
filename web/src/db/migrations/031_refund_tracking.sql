-- Refund management, v1 scope: fills three real gaps found in the existing
-- Stripe-only refundBooking (src/app/dashboard/bookings/actions.ts) —
-- package-redeemed bookings and cash/in-person bookings had no refund path
-- at all, and no refund amount/date was ever persisted (only a coarse
-- REFUNDED/PARTIALLY_REFUNDED status label). See refundBooking in
-- src/app/dashboard/bookings/actions.ts for the three-way branch this
-- enables (Stripe charge / package redemption / cash-in-person).
--
-- Nullable, set once per booking (this app still supports only one refund
-- per booking, same as before this migration) — never re-derived from
-- Stripe or recomputed, the row itself is the record.
ALTER TABLE bookings ADD COLUMN refunded_amount INT;
ALTER TABLE bookings ADD COLUMN refunded_at TIMESTAMPTZ;

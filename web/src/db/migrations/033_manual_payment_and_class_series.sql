-- Two small, additive owner-UX gaps — no existing row changes meaning.
--
-- 1) Payment tracking for staff-created (phone/walk-in) bookings.
-- createManualBooking skips the online hold->pay flow entirely, so until now
-- the dashboard had no way to record whether the customer had actually paid
-- yet, paid a deposit, or still owes the full amount. `amount` keeps its
-- existing meaning (what this booking is worth — what Reports count);
-- amount_paid is how much of that has actually been collected so far.
--
-- NULL = not tracked this way: every online booking (Stripe/package/cash
-- checkout, where status already says whether payment happened) and every
-- manual booking created before this migration. Only manual bookings set it.
ALTER TABLE bookings ADD COLUMN amount_paid INT
  CHECK (amount_paid IS NULL OR (amount_paid >= 0 AND amount_paid <= amount));
-- Free-text owner note about payment specifically (e.g. "complimentary",
-- "paid by bank transfer") — separate from owner_note, which is about the
-- booking itself.
ALTER TABLE bookings ADD COLUMN payment_note TEXT;

-- 2) Weekly-repeat class sessions grouped as one series.
-- createClassSession's repeat option inserts N fully independent
-- class_sessions rows; each stays independently cancellable/removable/
-- reassignable exactly as before. series_id is only a grouping label so the
-- Classes page can show them as one entry instead of N cards. NULL = a
-- one-off session (and every session created before this migration).
-- No FK target — there's no separate "series" table to manage; the series
-- simply is whatever rows share the id.
ALTER TABLE class_sessions ADD COLUMN series_id UUID;
CREATE INDEX ON class_sessions (series_id) WHERE series_id IS NOT NULL;

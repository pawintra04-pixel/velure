-- Owner-facing notes/flags on a single booking or a whole class session —
-- e.g. "VIP customer, needs extra attention" — surfaced as a distinct
-- highlight color on the calendar grid and a small reminders banner for
-- anything flagged/noted still upcoming today. Purely informational: never
-- read by the booking/payment/availability engines, so it can't affect
-- correctness — a flagged booking books, pays, and expires exactly like an
-- unflagged one.
ALTER TABLE bookings ADD COLUMN owner_note TEXT;
ALTER TABLE bookings ADD COLUMN is_flagged BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE class_sessions ADD COLUMN owner_note TEXT;
ALTER TABLE class_sessions ADD COLUMN is_flagged BOOLEAN NOT NULL DEFAULT false;

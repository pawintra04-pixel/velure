-- Where a booking actually came from (reception QR, Instagram bio link,
-- etc.) — captured from a `?src=` query param on the public booking page
-- at the moment a slot is held (see book/actions.ts), not asked of the
-- customer. NULL for the overwhelming majority of historical bookings and
-- any link with no ?src= on it — that's "unknown source", not an error.
ALTER TABLE bookings ADD COLUMN source TEXT;

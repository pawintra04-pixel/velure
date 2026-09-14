CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Needed for EXCLUDE USING gist with an equality (=) term on a uuid column,
-- combined with the tstzrange overlap term — see 006_bookings.sql.
CREATE EXTENSION IF NOT EXISTS btree_gist;

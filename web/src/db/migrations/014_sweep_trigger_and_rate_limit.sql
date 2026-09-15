-- Hardening pass after external architecture review. Two independent
-- changes:
--
-- 1. Move "sweep expired holds before they can block a slot" from
--    something every write path has to remember to call in application
--    code into a DB trigger that fires on every insert automatically.
--    The EXCLUDE constraint can't do this itself — a partial index
--    predicate can't reference now(), so "is this hold logically expired"
--    can never be baked into the constraint directly. A trigger is the
--    correct place for it: it can't be forgotten by a future write path
--    (manual booking by staff, an import, anything) the way a manual
--    sweepExpiredHolds() call in TypeScript could be. Scoped to
--    NEW.staff_id (matching what the exclusion constraint itself checks)
--    rather than sweeping the whole business, and only on INSERT — the
--    UPDATE path (reschedule) already surfaces a stale collision as a
--    normal "that time was just taken" error via the exclusion constraint
--    itself, so it doesn't need this.
CREATE OR REPLACE FUNCTION sweep_expired_holds_for_staff() RETURNS TRIGGER AS $$
DECLARE
  swept RECORD;
BEGIN
  FOR swept IN
    UPDATE bookings SET status = 'EXPIRED'
    WHERE staff_id = NEW.staff_id
      AND status IN ('TEMPORARY_HOLD', 'PAYMENT_PENDING')
      AND hold_expires_at < now()
    RETURNING class_session_id
  LOOP
    IF swept.class_session_id IS NOT NULL THEN
      UPDATE class_sessions SET seats_booked = seats_booked - 1 WHERE id = swept.class_session_id;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sweep_expired_holds_before_insert
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION sweep_expired_holds_for_staff();

-- 2. Cap how many un-completed holds one anonymous visitor can pile up.
-- Quick booking intentionally lets a customer reserve a slot before
-- typing anything, which also means nothing currently stops a visitor
-- from grabbing every remaining slot in a day with no contact info
-- attached — a business-visible "we're fully booked" that isn't real.
-- anon_id is a random token set in a cookie the first time a visitor
-- hits the booking flow (see lib/anon-session.ts); it's not identity, just
-- a rate-limit key, so it carries no RLS/business-scoping implications of
-- its own — application code still checks it against this same business's
-- active holds only.
ALTER TABLE bookings ADD COLUMN anon_id TEXT;
CREATE INDEX ON bookings (anon_id) WHERE anon_id IS NOT NULL;

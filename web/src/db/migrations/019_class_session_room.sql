-- Classes can now be assigned to a physical resource (a studio/room) —
-- `resources` already existed for regular 1:1 bookings (see
-- 004_staff_resources_services.sql / 006_bookings.sql) but class_sessions
-- had no equivalent column, so a class had nowhere to record which room
-- it's in. Nullable: a business with no rooms to track just leaves it
-- unset, same as bookings.resource_id already does.
ALTER TABLE class_sessions ADD COLUMN resource_id UUID REFERENCES resources(id);

-- Same guard bookings already has for resource_id (006_bookings.sql) — two
-- classes can't claim the same room at overlapping times. Mirrors
-- no_overlapping_class_sessions' own staff guard just below it.
-- Known gap, same shape as the staff one documented in
-- 013_class_sessions.sql: this only checks class_sessions against itself —
-- a class and a regular 1:1 booking claiming the same room at the same time
-- isn't caught by any single constraint (one EXCLUDE can't span tables).
ALTER TABLE class_sessions ADD CONSTRAINT no_overlapping_class_session_rooms
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (resource_id IS NOT NULL);

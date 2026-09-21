-- Lets an owner temporarily take a room/station out of service (e.g. closed
-- for renovation) without deleting it and losing its schedule history.
-- Inactive resources stay visible with their existing bookings/classes
-- intact — this only affects whether they can be picked for NEW class
-- sessions going forward (see CreateSessionForm's resource list).
ALTER TABLE resources ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

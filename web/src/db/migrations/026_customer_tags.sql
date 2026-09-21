-- Free-text owner tags on a customer (e.g. "VIP", "allergic to lavender")
-- — deliberately a plain array column, not a separate tags table: at pilot
-- scale there's no need for a shared tag vocabulary/autocomplete across
-- customers, and a second table would just be a join for no real benefit
-- yet. GIN index makes "customers with tag X" filtering fast once a
-- business has enough customers for that to matter.
ALTER TABLE customers ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX ON customers USING GIN (tags);

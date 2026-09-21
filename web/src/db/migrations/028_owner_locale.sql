-- Owner dashboard language preference — deliberately separate from
-- anything customer-facing (the public booking pages stay English; this
-- pilot's actual customers are mostly foreign tourists per the business
-- owner, so translating *that* side would be solving the wrong problem).
-- Per-owner, not per-business: the roadmap's own Phase 7 note is "a Thai
-- business may operate its dashboard in Thai while foreign customers book
-- in English" — this column is that switch, for the one person it's
-- actually about.
ALTER TABLE owners ADD COLUMN locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'th'));

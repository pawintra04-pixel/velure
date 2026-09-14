-- A public, stable identifier for a business's booking page (docs/ARCHITECTURE.md's
-- "standalone booking link" requirement) — separate from the internal uuid `id`.
ALTER TABLE businesses ADD COLUMN slug TEXT;
UPDATE businesses SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(id::text, 1, 8)
  WHERE slug IS NULL;
ALTER TABLE businesses ALTER COLUMN slug SET NOT NULL;
ALTER TABLE businesses ADD CONSTRAINT businesses_slug_key UNIQUE (slug);

-- One owner account per business for MVP (no staff logins yet — every
-- authenticated dashboard user IS the business). Not RLS-scoped: looking
-- someone up by email/session token necessarily happens BEFORE any business
-- context exists, the same category of exception as the Stripe webhook (see
-- db/client.ts's doc comment on adminPool). Only ever touched via adminPool.
CREATE TABLE owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES businesses(id),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES owners(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON sessions (owner_id);

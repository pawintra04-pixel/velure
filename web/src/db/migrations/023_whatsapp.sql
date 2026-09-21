-- Per-business WhatsApp Business Platform (Meta Cloud API) connection —
-- deliberately NOT a shared platform-wide number, unlike the earlier LINE
-- stub's single env-var channel token (016_line_notifications.sql). Each
-- business brings its own phone_number_id + access token, entered by hand
-- in Settings for now (see docs on WhatsAppSection.tsx for why: Meta's
-- Embedded Signup OAuth flow needs App Review first, so manual entry is
-- the fastest real-in-production path, same reasoning as Stripe's
-- Standard-account self-serve flow before Connect OAuth was worth it).
--
-- whatsapp_access_token_encrypted is exactly that — encrypted, not
-- plaintext, via src/lib/crypto.ts (AES-256-GCM, key from the
-- ENCRYPTION_KEY env var) — this is a real bearer credential that can
-- send messages *as the business*, unlike stripe_account_id (just an
-- id, not a secret) which is the only other per-business "connection"
-- token this schema has stored so far.
ALTER TABLE businesses ADD COLUMN whatsapp_phone_number_id TEXT;
ALTER TABLE businesses ADD COLUMN whatsapp_access_token_encrypted TEXT;
CREATE UNIQUE INDEX ON businesses (whatsapp_phone_number_id) WHERE whatsapp_phone_number_id IS NOT NULL;

-- Lets a business flesh out a service beyond name/price/duration — a
-- longer description and a photo for the public booking page — plus a set
-- of owner-defined note fields customers fill in at booking time (e.g.
-- "Any allergies?", "Preferred pressure"). Each field carries an
-- importance so the booking form knows which are cosmetic (optional),
-- which to visually flag (important), and which actually block submission
-- (required).

ALTER TABLE services ADD COLUMN description TEXT;
ALTER TABLE services ADD COLUMN image_url TEXT;

CREATE TYPE field_importance AS ENUM ('optional', 'important', 'required');

CREATE TABLE service_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  importance field_importance NOT NULL DEFAULT 'optional',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON service_custom_fields (business_id);
CREATE INDEX ON service_custom_fields (service_id);

-- A customer's answers. Snapshots the field's label/importance at booking
-- time (rather than joining live to service_custom_fields) so editing or
-- deleting a field later never rewrites what a past customer was actually
-- asked and answered.
CREATE TABLE booking_field_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  field_id UUID REFERENCES service_custom_fields(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  importance field_importance NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON booking_field_responses (business_id);
CREATE INDEX ON booking_field_responses (booking_id);

ALTER TABLE service_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_custom_fields FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON service_custom_fields USING (business_id = current_business_id());

ALTER TABLE booking_field_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_field_responses FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON booking_field_responses USING (business_id = current_business_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON service_custom_fields TO app_user;
GRANT SELECT, INSERT ON booking_field_responses TO app_user;

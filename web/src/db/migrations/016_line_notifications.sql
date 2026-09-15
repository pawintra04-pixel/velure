-- LINE OA notifications — flagged as the highest-priority post-P0 item in
-- an external review specifically for the Thai market. A customer's LINE
-- user id can only be obtained by them actually connecting their account
-- (LINE Login), not derived from anything already on file (phone/email
-- don't map to a LINE user id), so this is additive to the existing
-- customer record rather than a new customer-identity table.
ALTER TABLE customers ADD COLUMN line_user_id TEXT;
CREATE INDEX ON customers (line_user_id) WHERE line_user_id IS NOT NULL;

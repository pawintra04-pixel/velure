-- Per-business self-service policy (docs/ARCHITECTURE.md: "เลื่อนได้ก่อน 12
-- ชม., ยกเลิกได้ก่อน 24 ชม." is the given example, not a fixed rule — each
-- shop sets its own). Defaults match that example.
ALTER TABLE businesses ADD COLUMN reschedule_cutoff_hours INT NOT NULL DEFAULT 12;
ALTER TABLE businesses ADD COLUMN cancel_cutoff_hours INT NOT NULL DEFAULT 24;

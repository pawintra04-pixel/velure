-- Advanced deposits & cancellation policies, v1 scope: deposit can now be a
-- percentage of price instead of only a fixed baht amount, and the
-- per-business cancel/reschedule cutoff hours (already enforced since
-- 010_cancellation_policy.sql, but with no owner-facing way to change them)
-- get a real settings form. No automated late-cancellation/no-show fee
-- charging in this pass — that would mean capturing a card before it's
-- needed, a real payment-architecture change the roadmap's own rules say
-- to stop and get separate approval for; the owner keeps deciding refunds
-- case by case via the existing manual refund flow (Phase 9).
--
-- Exactly one of deposit_amount/deposit_percent may be set for a
-- 'deposit'-mode service — replaces the old unconditional
-- deposit_amount_required_for_deposit_mode constraint, which would have
-- rejected a percent-only deposit.
ALTER TABLE services DROP CONSTRAINT deposit_amount_required_for_deposit_mode;
ALTER TABLE services ADD COLUMN deposit_percent INT CHECK (deposit_percent IS NULL OR (deposit_percent > 0 AND deposit_percent <= 100));
ALTER TABLE services ADD CONSTRAINT deposit_exactly_one_kind_for_deposit_mode
  CHECK (
    payment_mode != 'deposit'
    OR ((deposit_amount IS NOT NULL) != (deposit_percent IS NOT NULL))
  );

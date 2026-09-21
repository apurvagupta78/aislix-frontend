-- Expiry verify_inspection: enforce 100% evidence coverage (physical units only).
-- Applied live 2026-09-21 via Lovable (full expiry_transition replace).
-- Gate: required = COALESCE(physical_count, actual_quantity);
-- verified = count of observations with readable date and not unreadable/wrong_product;
-- RAISE 'EVIDENCE INCOMPLETE' unless verified >= required before status = verified.
--
-- Note: function body is managed in production; re-apply from live definition if needed.

SELECT 1;

-- ============================================================
-- LOVABLE / SUPABASE SQL EDITOR — one-shot demo environment setup
-- Project: vythviniybatyrdyrmhg (aislix.com)
--
-- Run this ENTIRE file in: Lovable → Backend → SQL editor (or Supabase Dashboard → SQL)
-- Safe to re-run: seed skips if audits already exist (use force block at bottom to reseed)
-- ============================================================

-- Step 1: Apply migration (idempotent)
\i is not supported in SQL editor — paste contents of:
--   supabase/migrations/20260918130000_demo_environment.sql
-- OR run that file first, then continue below.

-- Step 2: Seed demo org + audits (owner = apurv@aislix.com)
DO $$
DECLARE
  v_owner UUID;
  v_result JSONB;
BEGIN
  SELECT id INTO v_owner FROM auth.users WHERE lower(email) = 'apurv@aislix.com' LIMIT 1;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'apurv@aislix.com not found in auth.users';
  END IF;

  v_result := public.seed_aislix_demo_environment(v_owner, false);
  RAISE NOTICE 'Seed result: %', v_result;
END $$;

-- Step 3: Quick validation
SELECT 'demo_org' AS check_name,
  EXISTS (SELECT 1 FROM organizations WHERE id = public.aislix_demo_org_id() AND is_demo) AS ok;

SELECT 'templates' AS check_name, count(*) AS n
FROM audit_templates WHERE org_id = public.aislix_demo_org_id() AND is_system_template;

SELECT 'completed_audits' AS check_name, count(*) AS n
FROM scan_assignments WHERE org_id = public.aislix_demo_org_id() AND status = 'completed';

SELECT 'maggi_variance_sec54' AS check_name, count(*) AS n
FROM digital_audit_lines l
JOIN stores st ON st.id = l.store_id
WHERE l.org_id = public.aislix_demo_org_id()
  AND l.sku = 'MAGGI-70G'
  AND st.name ILIKE '%Sec 54%'
  AND COALESCE(l.variance_qty, 0) <> 0;

-- Force reseed (destructive for demo org audits only):
-- SELECT public.seed_aislix_demo_environment(
--   (SELECT id FROM auth.users WHERE lower(email) = 'apurv@aislix.com'),
--   true
-- );

-- Rewrite learned_skus policies to use the private (non-API) membership helper
DROP POLICY IF EXISTS learned_skus_org_select ON public.learned_skus;
DROP POLICY IF EXISTS learned_skus_org_insert ON public.learned_skus;
DROP POLICY IF EXISTS learned_skus_org_update ON public.learned_skus;

CREATE POLICY learned_skus_org_select ON public.learned_skus
  FOR SELECT TO authenticated
  USING (org_id IS NOT NULL AND private.is_org_member_current(org_id));

CREATE POLICY learned_skus_org_insert ON public.learned_skus
  FOR INSERT TO authenticated
  WITH CHECK (org_id IS NOT NULL AND private.is_org_member_current(org_id));

CREATE POLICY learned_skus_org_update ON public.learned_skus
  FOR UPDATE TO authenticated
  USING (org_id IS NOT NULL AND private.is_org_member_current(org_id))
  WITH CHECK (org_id IS NOT NULL AND private.is_org_member_current(org_id));

-- Remove the SECURITY DEFINER helper from the exposed API schema entirely
REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.is_org_member(uuid);
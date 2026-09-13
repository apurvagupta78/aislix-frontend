ALTER POLICY "planogram_promotions_org"
ON public.planogram_promotions
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members AS membership
    WHERE membership.org_id = planogram_promotions.org_id
      AND membership.user_id = auth.uid()
      AND membership.status = 'active'::public.member_status
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organization_members AS membership
    WHERE membership.org_id = planogram_promotions.org_id
      AND membership.user_id = auth.uid()
      AND membership.status = 'active'::public.member_status
  )
);
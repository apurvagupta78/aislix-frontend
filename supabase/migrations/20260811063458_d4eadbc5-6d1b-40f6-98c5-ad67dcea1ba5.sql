CREATE POLICY "notifications_manager_insert" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  private.is_org_manager_current(org_id)
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.org_id = notifications.org_id
      AND om.user_id = notifications.user_id
      AND om.status = 'active'
  )
);
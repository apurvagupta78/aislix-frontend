-- One result row per scan (enables upsert on scan_id)
DELETE FROM public.scan_results a
USING public.scan_results b
WHERE a.scan_id = b.scan_id AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS scan_results_scan_id_key
  ON public.scan_results (scan_id);

-- One analytics row per org/store/day (store_id may be null)
CREATE UNIQUE INDEX IF NOT EXISTS shelf_analytics_org_store_date_key
  ON public.shelf_analytics (org_id, store_id, period_date)
  WHERE store_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS shelf_analytics_org_date_key
  ON public.shelf_analytics (org_id, period_date)
  WHERE store_id IS NULL;

-- Any active member may write the derived analytics rollup for their org
DROP POLICY IF EXISTS analytics_write_admins ON public.shelf_analytics;

CREATE POLICY analytics_insert_members
ON public.shelf_analytics
FOR INSERT
TO authenticated
WITH CHECK (public.is_org_member(org_id, auth.uid()));

CREATE POLICY analytics_update_members
ON public.shelf_analytics
FOR UPDATE
TO authenticated
USING (public.is_org_member(org_id, auth.uid()))
WITH CHECK (public.is_org_member(org_id, auth.uid()));

CREATE POLICY analytics_delete_admins
ON public.shelf_analytics
FOR DELETE
TO authenticated
USING (public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']::app_role[]));

-- Allow re-uploading an annotated image at the same storage path
CREATE POLICY scan_images_update_members
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'scan-images'
  AND EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.org_id::text = (storage.foldername(objects.name))[1]
  )
)
WITH CHECK (
  bucket_id = 'scan-images'
  AND EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.org_id::text = (storage.foldername(objects.name))[1]
  )
);
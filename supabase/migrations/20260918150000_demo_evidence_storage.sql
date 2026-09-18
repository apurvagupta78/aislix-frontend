-- Demo showcase: read scan_images metadata + scan-images storage for demo org folder.

DROP POLICY IF EXISTS demo_showcase_read ON public.scan_images;
CREATE POLICY demo_showcase_read ON public.scan_images
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.shelf_scans s
      WHERE s.id = scan_id
        AND public.is_demo_org_readable(s.org_id)
    )
  );

DROP POLICY IF EXISTS demo_scan_images_storage_read ON storage.objects;
CREATE POLICY demo_scan_images_storage_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'scan-images'
    AND (storage.foldername(name))[1] = public.aislix_demo_org_id()::text
  );

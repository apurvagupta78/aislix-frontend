-- Intelligence: Aislix-drawn charts picked by the AI, and files the user attached.
ALTER TABLE public.intelligence_reports
  ADD COLUMN IF NOT EXISTS charts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Files are checked and written by the server only (service role). Path: <org_id>/<user_id>/<file>.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'intelligence-attachments',
  'intelligence-attachments',
  false,
  10485760,
  ARRAY[
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS intelligence_attachments_read_own ON storage.objects;
CREATE POLICY intelligence_attachments_read_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'intelligence-attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.org_id::text = (storage.foldername(name))[1]
    )
  );

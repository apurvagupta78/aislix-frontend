DROP POLICY IF EXISTS contact_insert_anyone ON public.contact_submissions;

CREATE POLICY contact_insert_anyone
ON public.contact_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());
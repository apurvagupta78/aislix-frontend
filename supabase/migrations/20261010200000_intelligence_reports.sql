-- Intelligence: a user picks completed audits, asks a question, and the AI writes a report.
-- Reports are private to the person who ran them ("Past analyses").

CREATE TABLE IF NOT EXISTS public.intelligence_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_ids uuid[] NOT NULL DEFAULT '{}',
  audits jsonb NOT NULL DEFAULT '[]'::jsonb,
  question text NOT NULL,
  report text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intelligence_reports_creator_idx
  ON public.intelligence_reports (org_id, created_by, created_at DESC);

ALTER TABLE public.intelligence_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intelligence_reports_select ON public.intelligence_reports;
CREATE POLICY intelligence_reports_select ON public.intelligence_reports
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() AND public.is_org_member(org_id));

DROP POLICY IF EXISTS intelligence_reports_delete ON public.intelligence_reports;
CREATE POLICY intelligence_reports_delete ON public.intelligence_reports
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Rows are written by the server after it checks audit access.
GRANT SELECT, DELETE ON public.intelligence_reports TO authenticated;
GRANT ALL ON public.intelligence_reports TO service_role;

-- Scheduled report emails. Each person schedules their own reports (daily or weekly) and the
-- sender runs with that person's store access, so a schedule never widens what they can see.

CREATE TABLE IF NOT EXISTS public.report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('store', 'exec', 'restock', 'field', 'claim')),
  segment text NOT NULL CHECK (segment IN ('supermarket', 'darkstore', 'fmcg', 'distributor', 'local')),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  days integer NOT NULL DEFAULT 7 CHECK (days IN (7, 30, 90)),
  preview_demo boolean NOT NULL DEFAULT false,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly')),
  weekday smallint CHECK (weekday BETWEEN 0 AND 6),
  send_hour smallint NOT NULL DEFAULT 9 CHECK (send_hour BETWEEN 0 AND 23),
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  recipients text[] NOT NULL CHECK (cardinality(recipients) BETWEEN 1 AND 5),
  enabled boolean NOT NULL DEFAULT true,
  next_run_at timestamptz NOT NULL,
  last_sent_at timestamptz,
  last_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_schedules_weekly_day CHECK (frequency = 'daily' OR weekday IS NOT NULL),
  CONSTRAINT report_schedules_store_report CHECK (kind <> 'store' OR store_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS report_schedules_due_idx
  ON public.report_schedules (next_run_at)
  WHERE enabled;
CREATE INDEX IF NOT EXISTS report_schedules_owner_idx
  ON public.report_schedules (created_by, org_id);

ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS report_schedules_own_select ON public.report_schedules;
CREATE POLICY report_schedules_own_select ON public.report_schedules
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() AND public.is_org_member(org_id));

DROP POLICY IF EXISTS report_schedules_own_insert ON public.report_schedules;
CREATE POLICY report_schedules_own_insert ON public.report_schedules
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_org_member(org_id));

DROP POLICY IF EXISTS report_schedules_own_update ON public.report_schedules;
CREATE POLICY report_schedules_own_update ON public.report_schedules
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND public.is_org_member(org_id))
  WITH CHECK (created_by = auth.uid() AND public.is_org_member(org_id));

DROP POLICY IF EXISTS report_schedules_own_delete ON public.report_schedules;
CREATE POLICY report_schedules_own_delete ON public.report_schedules
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND public.is_org_member(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_schedules TO authenticated;
GRANT ALL ON public.report_schedules TO service_role;

-- Shared secrets between the website server and the backend (both hold the service role).
-- No policies: only the service role can read it.
CREATE TABLE IF NOT EXISTS public.service_secrets (
  name text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.service_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.service_secrets FROM anon, authenticated;
GRANT ALL ON public.service_secrets TO service_role;

INSERT INTO public.service_secrets (name, value)
VALUES (
  'report_cron',
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
)
ON CONFLICT (name) DO NOTHING;

GRANT EXECUTE ON FUNCTION public.segment_dashboard(uuid, timestamptz, timestamptz, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.field_team_coverage(uuid, timestamptz, timestamptz, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_proof_pack(uuid, timestamptz, timestamptz, uuid[], integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.restock_list(uuid, timestamptz, timestamptz, uuid[], integer) TO service_role;

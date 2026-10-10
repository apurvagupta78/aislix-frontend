-- Periodic work inside the database: recurring audit schedules, due/overdue
-- assignment reminders and corrective-action SLA escalations (called from
-- process_assignment_reminders). All are idempotent.

-- Schedules created without an evidence policy passed NULL into the NOT NULL
-- scan_assignments.evidence_policy column and aborted every scheduler run.
CREATE OR REPLACE FUNCTION public.scan_assignments_default_evidence_policy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.evidence_policy IS NULL THEN
    NEW.evidence_policy := jsonb_build_object(
      'level', 'standard',
      'requiredProof', jsonb_build_array('context_photo', 'variance_photo'),
      'captureSource', 'either',
      'minimumPhotos', 1,
      'qualityChecks', jsonb_build_array('blur', 'dark', 'duplicate_hash'),
      'reviewMode', 'manager'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scan_assignments_default_evidence_policy ON public.scan_assignments;
CREATE TRIGGER scan_assignments_default_evidence_policy
  BEFORE INSERT OR UPDATE OF evidence_policy ON public.scan_assignments
  FOR EACH ROW EXECUTE FUNCTION public.scan_assignments_default_evidence_policy();

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Separate jobs so a failure in one never blocks the other.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'aislix-ops-every-15-min') THEN
    PERFORM cron.unschedule('aislix-ops-every-15-min');
  END IF;
END $$;

SELECT cron.schedule('aislix-audit-schedules-15m', '*/15 * * * *', $$SELECT public.process_due_audit_schedules(100)$$);
SELECT cron.schedule('aislix-reminders-escalations-15m', '*/15 * * * *', $$SELECT public.process_assignment_reminders(500)$$);

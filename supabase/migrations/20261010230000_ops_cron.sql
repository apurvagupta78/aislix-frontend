-- Periodic work inside the database: recurring audit schedules, due/overdue
-- assignment reminders and corrective-action SLA escalations (called from
-- process_assignment_reminders). All three are idempotent.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'aislix-ops-every-15-min',
  '*/15 * * * *',
  $$SELECT public.process_due_audit_schedules(100); SELECT public.process_assignment_reminders(500);$$
);

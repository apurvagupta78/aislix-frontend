-- Wakes /api/cron/report-schedules (scheduled report emails + SLA alerts) from the
-- database scheduler. The bearer token is read from service_secrets at run time.
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'aislix-report-schedules-15m',
  '*/15 * * * *',
  $$SELECT net.http_post(
      url := 'https://aislix.com/api/cron/report-schedules',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM public.service_secrets WHERE name = 'report_cron')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    )$$
);

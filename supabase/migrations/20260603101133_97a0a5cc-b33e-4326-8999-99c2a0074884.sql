CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'process-pms-sync-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rarhqnvvbjzfdevnghnz.supabase.co/functions/v1/pms-sync-queue-process',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhcmhxbnZ2Ymp6ZmRldm5naG56Iiwicm9sZSI6ImФub24iLCJpYXQiOjE3NTE4NzYwNzgsImV4cCI6MjA2NzQ1MjA3OH0.yvG3MIFbssrNa8wl5qFBi5NWBgZq0gmy8Ovc3yGoliY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
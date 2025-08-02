-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily archiving at 20:00 UTC (8 PM)
SELECT cron.schedule(
  'archive-daily-data-at-8pm',
  '0 20 * * *', -- Every day at 20:00 UTC
  $$
  SELECT
    net.http_post(
        url:='https://rarhqnvvbjzfdevnghnz.supabase.co/functions/v1/archive-daily-data',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhcmhxbnZ2Ymp6ZmRldm5naG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4NzYwNzgsImV4cCI6MjA2NzQ1MjA3OH0.yvG3MIFbssrNa8wl5qFBi5NWBgZq0gmy8Ovc3yGoliY"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;
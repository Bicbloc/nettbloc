-- Remove existing schedule if re-running
select cron.unschedule('auto-close-day-every-15min')
where exists (select 1 from cron.job where jobname = 'auto-close-day-every-15min');

select cron.schedule(
  'auto-close-day-every-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://rarhqnvvbjzfdevnghnz.supabase.co/functions/v1/auto-close-day',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhcmhxbnZ2Ymp6ZmRldm5naG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4NzYwNzgsImV4cCI6MjA2NzQ1MjA3OH0.yvG3MIFbssrNa8wl5qFBi5NWBgZq0gmy8Ovc3yGoliY"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);
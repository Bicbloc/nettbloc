-- Auto-closure scheduling configuration per establishment
ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS auto_close_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_close_time time NOT NULL DEFAULT '23:00',
  ADD COLUMN IF NOT EXISTS auto_close_days integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  ADD COLUMN IF NOT EXISTS auto_close_timezone text NOT NULL DEFAULT 'Europe/Paris',
  ADD COLUMN IF NOT EXISTS last_auto_close_date date;

-- Required extensions for scheduled HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;